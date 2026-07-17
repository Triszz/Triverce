import { PrismaClient, Prisma } from "@prisma/client";
import { OrderEntity, OrderStatus } from "./order.entity";
import { OrderStatusLogEntity } from "./order-status-log.entity";
import { OrderItemEntity } from "./order-item.entity";

/**
 * OrderRepository — Prisma-backed.
 *
 * Public API unchanged. Methods that took a Kysely transaction now take
 * a `Prisma.TransactionClient` (compatible with `prisma.$transaction(async tx => …)`
 * as well as the standalone client).
 *
 * The inventory row-lock (`SELECT … FOR UPDATE`) is preserved via raw SQL
 * inside an interactive transaction so concurrent checkouts can't oversell.
 */
export class OrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Exposed for service-level transactions. Returns the PrismaClient —
   * `prisma.$transaction(async tx => …)` produces a `TransactionClient`
   * that can be passed to all repo methods that accept the optional
   * `trx` parameter.
   */
  get client(): PrismaClient {
    return this.prisma;
  }

  /**
   * Lock inventory rows inside a transaction to prevent oversell.
   * Uses raw SQL `SELECT … FOR UPDATE` which is the only way to do
   * row-level pessimistic locks in Prisma.
   */
  async lockInventoryForUpdate(
    variantIds: string[],
    trx: Prisma.TransactionClient,
  ): Promise<{ variantId: string; quantity: number; reserved: number }[]> {
    if (variantIds.length === 0) return [];

    // Cast to text[], then to uuid[]
    const rows = await trx.$queryRaw<
      Array<{ variant_id: string; quantity: number; reserved: number }>
    >`
      SELECT variant_id, quantity, reserved
      FROM inventory
      WHERE variant_id = ANY(${variantIds}::uuid[])
      ORDER BY variant_id ASC
      FOR UPDATE
    `;

    return rows.map((r) => ({
      variantId: r.variant_id,
      quantity: Number(r.quantity),
      reserved: Number(r.reserved),
    }));
  }

  async createOrder(
    data: {
      customerId: string;
      sellerId: string;
      totalAmount: number;
      shippingName: string;
      shippingPhone: string;
      shippingAddress: string;
      note?: string;
      paymentId: string;
    },
    trx: Prisma.TransactionClient,
  ): Promise<string> {
    const row = await trx.order.create({
      data: {
        customerId: data.customerId,
        sellerId: data.sellerId,
        totalAmount: data.totalAmount,
        shippingName: data.shippingName,
        shippingPhone: data.shippingPhone,
        shippingAddress: data.shippingAddress,
        note: data.note ?? null,
        paymentId: data.paymentId,
        status: "pending",
      },
      select: { id: true },
    });
    return row.id;
  }

  async createOrderItems(
    items: {
      orderId: string;
      variantId: string;
      quantity: number;
      unitPrice: number;
      productName: string;
      variantSku: string;
    }[],
    trx: Prisma.TransactionClient,
  ): Promise<void> {
    await trx.orderItem.createMany({
      data: items.map((i) => ({
        orderId: i.orderId,
        variantId: i.variantId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        productName: i.productName,
        variantSku: i.variantSku,
      })),
    });
  }

  async createStatusLog(
    data: {
      orderId: string;
      fromStatus: OrderStatus | null;
      toStatus: OrderStatus;
      changedBy: string | null;
      note?: string;
    },
    trx: Prisma.TransactionClient,
  ): Promise<void> {
    await trx.orderStatusLog.create({
      data: {
        orderId: data.orderId,
        fromStatus: data.fromStatus,
        toStatus: data.toStatus,
        changedBy: data.changedBy,
        note: data.note ?? null,
      },
    });
  }

  async findById(
    orderId: string,
    trx?: Prisma.TransactionClient,
  ): Promise<OrderEntity | null> {
    const client = trx ?? this.prisma;
    const row = await client.order.findUnique({ where: { id: orderId } });
    if (!row) return null;

    const [items, logs, payment] = await Promise.all([
      this.loadItems(orderId, client),
      this.loadStatusLogs(orderId, client),
      this.loadPayment(row.paymentId, client),
    ]);
    return OrderEntity.fromDatabase(row, items, logs, payment);
  }

  /**
   * Idempotently transition an order from `expectedFromStatus` to
   * `newStatus`, appending a `OrderStatusLog` row in the same
   * transaction.
   *
   * Why this exists:
   *   Payment gateways can hit both the IPN webhook AND the browser
   *   return URL for the same transaction (classic VNPay race). The
   *   payment row's `status !== "pending"` check in `PaymentService`
   *   dedupes the *payment* update, but the cascading order update +
   *   log insert in `updateRelatedOrders` ran unconditionally. Two
   *   concurrent callers would each write the same `pending -> paid`
   *   log row, surfacing as the "two 'Pending -> Confirmed (Payment
   *   paid)' logs at the same timestamp" UI bug.
   *
   * How the guard works:
   *   `updateStatus` is the *only* point we mutate `orders.status`.
   *   We re-read the row inside the transaction (so we see any
   *   concurrent write from the other path) and abort with `false`
   *   if its current status no longer matches `expectedFromStatus`.
   *   On a successful transition we `return true` so the caller knows
   *   it owns the log write; on a `false` return the caller MUST NOT
   *   insert a log row.
   *
   * Concurrent safety:
   *   PostgreSQL's default READ COMMITTED isolation is sufficient
   *   here: both callers' UPDATE statements will attempt to flip the
   *   row's status from "pending" to "confirmed". The second one
   *   simply won't find any row matching the WHERE clause and will
   *   affect 0 rows — exactly what we want.
   */
  async confirmOrderAfterPayment(
    args: {
      orderId: string;
      /** The status the order must be in for the transition to apply. */
      expectedFromStatus: OrderStatus;
      newStatus: OrderStatus;
      note: string;
      /** Null for system events (e.g. webhook), userId for seller-driven. */
      changedBy: string | null;
    },
    trx: Prisma.TransactionClient,
  ): Promise<boolean> {
    // Single round-trip: UPDATE … WHERE status = expectedFromStatus.
    // Returns the row count; 0 means someone else got there first.
    const updated = await trx.order.updateMany({
      where: {
        id: args.orderId,
        status: args.expectedFromStatus,
      },
      data: { status: args.newStatus },
    });
    if (updated.count === 0) return false;

    await this.createStatusLog(
      {
        orderId: args.orderId,
        fromStatus: args.expectedFromStatus,
        toStatus: args.newStatus,
        changedBy: args.changedBy,
        note: args.note,
      },
      trx,
    );
    return true;
  }

  async findByCustomerId(
    customerId: string,
    page: number,
    limit: number,
  ): Promise<{ orders: OrderEntity[]; total: number }> {
    const where = { customerId };
    const [total, rows] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const orders = await Promise.all(
      rows.map(async (row) => {
        const [items, payment] = await Promise.all([
          this.loadItems(row.id),
          this.loadPayment(row.paymentId),
        ]);
        return OrderEntity.fromDatabase(row, items, [], payment);
      }),
    );

    return { orders, total };
  }

  async findBySellerId(
    sellerId: string,
    page: number,
    limit: number,
  ): Promise<{ orders: OrderEntity[]; total: number }> {
    const where = { sellerId };
    const [total, rows] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const orders = await Promise.all(
      rows.map(async (row) => {
        const [items, payment] = await Promise.all([
          this.loadItems(row.id),
          this.loadPayment(row.paymentId),
        ]);
        return OrderEntity.fromDatabase(row, items, [], payment);
      }),
    );

    return { orders, total };
  }

  async updateStatus(
    orderId: string,
    status: OrderStatus,
    cancelledReason?: string,
    trx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = trx ?? this.prisma;
    await client.order.update({
      where: { id: orderId },
      data: {
        status,
        cancelledReason: cancelledReason ?? null,
      },
    });
  }

  /**
   * COD payment auto-settle on delivery.
   *
   * When a seller marks a COD order as `delivered`, the cash has
   * physically been collected — the corresponding `Payment` row must
   * flip to `paid` in the same transaction so the seller dashboard
   * (and any downstream reconciliation) reflects the real state.
   *
   * Guarded at the database level with a `WHERE gateway = 'cod' AND
   * status != 'paid'` clause, so the call is a no-op (count = 0) for:
   *   - Non-COD gateways (vnpay, momo, stripe) — they have their own
   *     settlement flow driven by gateway callbacks.
   *   - Payments that are already in a terminal state (paid, refunded,
   *     cancelled, failed) — re-delivering shouldn't reopen or
   *     duplicate-settle them.
   *
   * Returns the rowcount so the caller can log a "synced" audit
   * entry when a real update happened, vs. a "skipped" entry when the
   * WHERE didn't match (the payment is already settled / not COD).
   * The status log write is the order's; a separate payment audit log
   * is out of scope for this fix.
   *
   * Why the read-then-merge for `gatewayData`:
   *   `confirmCOD` writes `gatewayData: { confirmedBy, confirmedAt }`
   *   onto the same row. If the seller manually confirms a COD order
   *   and then later marks it delivered, we MUST NOT clobber those
   *   markers — they're the audit trail of who flipped it to paid in
   *   the first place. We pull the existing blob inside the
   *   transaction (so concurrent writes are serialized) and spread it
   *   before adding the `codCollectedAt` field.
   */
  async markCodPaymentAsPaid(
    paymentId: string,
    trx: Prisma.TransactionClient,
  ): Promise<number> {
    // Read first so we can preserve any existing gatewayData. Both
    // reads happen inside the transaction so a concurrent writer
    // (e.g. the webhook handler) can't slip between the SELECT and
    // UPDATE.
    const existing = await trx.payment.findUnique({
      where: { id: paymentId },
      select: { gateway: true, status: true, gatewayData: true },
    });

    // Double-check the guards here too — defense in depth in case the
    // caller races with another transition. `updateMany`'s WHERE is
    // the source of truth for atomicity.
    if (!existing) return 0;
    if (existing.gateway !== "cod") return 0;
    if (existing.status === "paid") return 0;

    const previousData =
      (existing.gatewayData as Record<string, unknown> | null) ?? {};
    const merged: Record<string, unknown> = {
      ...previousData,
      codCollectedAt: new Date().toISOString(),
    };

    const result = await trx.payment.updateMany({
      where: {
        id: paymentId,
        gateway: "cod",
        // Anything other than "paid" — covers "pending", "processing",
        // "failed", "cancelled". Idempotent: a second delivery event
        // for an already-paid row matches nothing and returns 0.
        NOT: { status: "paid" },
      },
      data: {
        status: "paid",
        gatewayData: merged as Prisma.InputJsonValue,
      },
    });
    return result.count;
  }

  /**
   * Subtract inventory after confirmation. Both `quantity` and `reserved`
   * drop by the same amount: the variant leaves "reserved but unsold" and
   * enters "sold".
   */
  async deductInventory(
    variantId: string,
    quantity: number,
    trx: Prisma.TransactionClient,
  ): Promise<void> {
    await trx.inventory.update({
      where: { variantId },
      data: {
        quantity: { decrement: quantity },
        reserved: { decrement: quantity },
      },
    });
  }

  private async loadItems(
    orderId: string,
    client: PrismaClient | Prisma.TransactionClient = this.prisma,
  ): Promise<OrderItemEntity[]> {
    // Issue #1 fix: include the variant + its attribute values so the
    // seller dashboard can render real thumbnails and real variant
    // descriptors (e.g. "Size: M · Color: Red") instead of fallbacks.
    // The relation depth is small (1 row per item, variant has at most a
    // handful of attribute values) so the extra join cost is negligible
    // compared to the listing round-trip.
    const rows = await client.orderItem.findMany({
      where: { orderId },
      include: {
        variant: {
          select: {
            imageUrl: true,
            attributeValues: {
              select: {
                value: true,
                attribute: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    return rows.map((row) =>
      OrderItemEntity.fromDatabase(row, {
        imageUrl: row.variant?.imageUrl ?? null,
        attributeValues: row.variant?.attributeValues ?? [],
      }),
    );
  }

  private async loadStatusLogs(
    orderId: string,
    client: PrismaClient | Prisma.TransactionClient = this.prisma,
  ): Promise<OrderStatusLogEntity[]> {
    const rows = await client.orderStatusLog.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(OrderStatusLogEntity.fromDatabase);
  }

  /**
   * Issue #3 fix: load the related payment row's `gateway` + `status`
   * so the order wire carries `paymentMethod` and `paymentStatus`.
   *
   * Only the two fields we expose are fetched; `gatewayData`,
   * `gatewayRef`, `idempotencyKey`, etc. stay on the payment side and
   * never leak into the order payload.
   *
   * Returns `null` when:
   *   - the order has no `payment_id` (rare — almost every checkout
   *     creates a payment row, even for COD), or
   *   - the payment row was deleted (FK is `SetNull`, so the order's
   *     `payment_id` is automatically cleared in that case and we'd
   *     see `null` here anyway).
   */
  private async loadPayment(
    paymentId: string | null,
    client: PrismaClient | Prisma.TransactionClient = this.prisma,
  ): Promise<import("./order.entity").OrderPaymentPayload | null> {
    if (!paymentId) return null;
    const row = await client.payment.findUnique({
      where: { id: paymentId },
      select: { gateway: true, status: true },
    });
    if (!row) return null;
    return {
      method: row.gateway as import("./order.entity").PaymentMethod,
      status: row.status as import("./order.entity").PaymentState,
    };
  }
}
