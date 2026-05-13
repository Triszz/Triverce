import { Kysely, Transaction, sql } from "kysely";
import { DatabaseSchema } from "../../infrastructure/database/db.schema";
import { OrderEntity } from "./order.entity";
import { OrderStatusLogEntity } from "./order-status-log.entity";
import { OrderItemEntity } from "./order-item.entity";
import { OrderStatus } from "./order.entity";

type DbOrTrx = Kysely<DatabaseSchema> | Transaction<DatabaseSchema>;

export class OrderRepository {
  constructor(private db: Kysely<DatabaseSchema>) {}

  get client(): Kysely<DatabaseSchema> {
    return this.db;
  }

  // Lock inventory rows in transaction -> avoid oversell
  async lockInventoryForUpdate(
    variantIds: string[],
    trx: Transaction<DatabaseSchema>,
  ): Promise<{ variantId: string; quantity: number; reserved: number }[]> {
    const rows = await sql<{
      variant_id: string;
      quantity: number;
      reserved: number;
    }>`
        SELECT variant_id, quantity, reserved
        FROM inventory
        WHERE variant_id = ANY(${sql.val(variantIds)}::uuid[])
        ORDER BY variant_id ASC
        FOR UPDATE
    `.execute(trx);

    return rows.rows.map((r) => ({
      variantId: r.variant_id,
      quantity: r.quantity,
      reserved: r.reserved,
    }));
  }

  // Create order
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
    trx: DbOrTrx,
  ): Promise<string> {
    const row = await trx
      .insertInto("orders")
      .values({
        customer_id: data.customerId,
        seller_id: data.sellerId,
        total_amount: data.totalAmount,
        shipping_name: data.shippingName,
        shipping_phone: data.shippingPhone,
        shipping_address: data.shippingAddress,
        note: data.note ?? null,
        payment_id: data.paymentId,
        status: "pending",
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    return row.id;
  }

  // Create order items
  async createOrderItems(
    items: {
      orderId: string;
      variantId: string;
      quantity: number;
      unitPrice: number;
      productName: string;
      variantSku: string;
    }[],
    trx: DbOrTrx,
  ): Promise<void> {
    await trx
      .insertInto("order_items")
      .values(
        items.map((i) => ({
          order_id: i.orderId,
          variant_id: i.variantId,
          quantity: i.quantity,
          unit_price: i.unitPrice,
          product_name: i.productName,
          variant_sku: i.variantSku,
        })),
      )
      .execute();
  }

  // Create status log
  async createStatusLog(
    data: {
      orderId: string;
      fromStatus: OrderStatus | null;
      toStatus: OrderStatus;
      changedBy: string;
      note?: string;
    },
    trx: DbOrTrx,
  ): Promise<void> {
    await trx
      .insertInto("order_status_logs")
      .values({
        order_id: data.orderId,
        from_status: data.fromStatus,
        to_status: data.toStatus,
        changed_by: data.changedBy,
        note: data.note ?? null,
      })
      .execute();
  }

  // Find order by id
  async findById(orderId: string, trx?: DbOrTrx): Promise<OrderEntity | null> {
    const db = trx ?? this.db;
    const row = await db
      .selectFrom("orders")
      .selectAll()
      .where("id", "=", orderId)
      .executeTakeFirst();

    if (!row) return null;

    const [items, logs] = await Promise.all([
      this.loadItems(orderId, db),
      this.loadStatusLogs(orderId, db),
    ]);

    return OrderEntity.fromDatabase(row, items, logs);
  }

  // Find orders of 1 customer
  async findByCustomerId(
    customerId: string,
    page: number,
    limit: number,
  ): Promise<{ orders: OrderEntity[]; total: number }> {
    const offset = (page - 1) * limit;

    const [rows, countResult] = await Promise.all([
      this.db
        .selectFrom("orders")
        .selectAll()
        .where("customer_id", "=", customerId)
        .orderBy("created_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute(),

      this.db
        .selectFrom("orders")
        .select((eb) => eb.fn.countAll<number>().as("count"))
        .where("customer_id", "=", customerId)
        .executeTakeFirstOrThrow(),
    ]);

    const orders = await Promise.all(
      rows.map(async (row) => {
        const items = await this.loadItems(row.id);
        return OrderEntity.fromDatabase(row, items, []);
      }),
    );

    return { orders, total: Number(countResult.count) };
  }

  // Find orders of 1 seller
  async findBySellerId(
    sellerId: string,
    page: number,
    limit: number,
  ): Promise<{ orders: OrderEntity[]; total: number }> {
    const offset = (page - 1) * limit;

    const [rows, countResult] = await Promise.all([
      this.db
        .selectFrom("orders")
        .selectAll()
        .where("seller_id", "=", sellerId)
        .orderBy("created_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute(),

      this.db
        .selectFrom("orders")
        .select((eb) => eb.fn.countAll<number>().as("count"))
        .where("seller_id", "=", sellerId)
        .executeTakeFirstOrThrow(),
    ]);

    const orders = await Promise.all(
      rows.map(async (row) => {
        const items = await this.loadItems(row.id);
        return OrderEntity.fromDatabase(row, items, []);
      }),
    );

    return { orders, total: Number(countResult.count) };
  }

  // Update status
  async updateStatus(
    orderId: string,
    status: OrderStatus,
    cancelledReason?: string,
    trx?: DbOrTrx,
  ): Promise<void> {
    const db = trx ?? this.db;
    await db
      .updateTable("orders")
      .set({
        status,
        cancelled_reason: cancelledReason ?? null,
        updated_at: new Date(),
      })
      .where("id", "=", orderId)
      .execute();
  }

  // Subtract inventory after confirmation (actual quantity)
  async deductInventory(
    variantId: string,
    quantity: number,
    trx: Transaction<DatabaseSchema>,
  ): Promise<void> {
    await trx
      .updateTable("inventory")
      .set((eb) => ({
        quantity: eb("quantity", "-", quantity),
        reserved: eb("reserved", "-", quantity), // release reserved from cart
        updated_at: new Date(),
      }))
      .where("variant_id", "=", variantId)
      .execute();
  }

  // Helpers
  private async loadItems(
    orderId: string,
    db: DbOrTrx = this.db,
  ): Promise<OrderItemEntity[]> {
    const rows = await db
      .selectFrom("order_items")
      .selectAll()
      .where("order_id", "=", orderId)
      .execute();

    return rows.map(OrderItemEntity.fromDatabase);
  }

  private async loadStatusLogs(
    orderId: string,
    db: DbOrTrx = this.db,
  ): Promise<OrderStatusLogEntity[]> {
    const rows = await db
      .selectFrom("order_status_logs")
      .selectAll()
      .where("order_id", "=", orderId)
      .orderBy("created_at", "asc")
      .execute();

    return rows.map(OrderStatusLogEntity.fromDatabase);
  }
}
