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

    const [items, logs] = await Promise.all([
      this.loadItems(orderId, client),
      this.loadStatusLogs(orderId, client),
    ]);
    return OrderEntity.fromDatabase(row, items, logs);
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
        const items = await this.loadItems(row.id);
        return OrderEntity.fromDatabase(row, items, []);
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
        const items = await this.loadItems(row.id);
        return OrderEntity.fromDatabase(row, items, []);
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
    const rows = await client.orderItem.findMany({ where: { orderId } });
    return rows.map(OrderItemEntity.fromDatabase);
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
}
