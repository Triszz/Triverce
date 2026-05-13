import { Kysely, Transaction } from "kysely";
import {
  DatabaseSchema,
  NewWebhookEvent,
  PaymentRow,
} from "../../infrastructure/database/db.schema";
import { PaymentEntity, PaymentStatus, PaymentGateway } from "./payment.entity";

type DbOrTrx = Kysely<DatabaseSchema> | Transaction<DatabaseSchema>;

export class PaymentRepository {
  constructor(private db: Kysely<DatabaseSchema>) {}

  get client(): Kysely<DatabaseSchema> {
    return this.db;
  }

  // Create payment record
  async create(
    data: {
      customerId: string;
      amount: number;
      currency: string;
      gateway: PaymentGateway;
      idempotencyKey: string;
    },
    trx: DbOrTrx,
  ): Promise<string> {
    const row = await trx
      .insertInto("payments")
      .values({
        customer_id: data.customerId,
        amount: data.amount,
        currency: data.currency,
        gateway: data.gateway,
        idempotency_key: data.idempotencyKey,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    return row.id;
  }

  // Find by id
  async findById(
    id: string,
    db: DbOrTrx = this.client,
  ): Promise<PaymentEntity | null> {
    const row = await db
      .selectFrom("payments")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!row) return null;

    const orderIds = await this.loadOrderIds(id, db);
    return PaymentEntity.fromDatabase(row, orderIds);
  }

  // Find by gateway_ref (use in webhook handler)
  async findByGatewayRef(
    gatewayRef: string,
    db: DbOrTrx = this.client,
  ): Promise<PaymentEntity | null> {
    const row = await db
      .selectFrom("payments")
      .selectAll()
      .where("gateway_ref", "=", gatewayRef)
      .executeTakeFirst();

    if (!row) return null;

    const orderIds = await this.loadOrderIds(row.id, db);
    return PaymentEntity.fromDatabase(row, orderIds);
  }

  // Update status + gatewayRef/Data
  async updateStatus(
    id: string,
    status: PaymentStatus,
    extra: { gatewayRef?: string; gatewayData?: unknown } = {},
    trx: DbOrTrx,
  ): Promise<void> {
    await trx
      .updateTable("payments")
      .set({
        status,
        gateway_ref: extra.gatewayRef,
        gateway_data: extra.gatewayData,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .execute();
  }

  // Set gateway after gateway create session successfully
  async setGatewayRef(
    id: string,
    gatewayRef: string,
    trx: DbOrTrx,
  ): Promise<void> {
    await trx
      .updateTable("payments")
      .set({ gateway_ref: gatewayRef, updated_at: new Date() })
      .where("id", "=", id)
      .execute();
  }

  // Idempotency guard cho webhook
  async saveWebhookEvent(
    data: {
      id: string;
      gateway: string;
      eventType: string;
      payload: unknown;
    },
    trx: DbOrTrx,
  ): Promise<boolean> {
    // Return true if successfully INSERT (not yet processed)
    // Return false if conflict (already processed)
    const result = await trx
      .insertInto("webhook_events")
      .values({
        id: data.id,
        gateway: data.gateway,
        event_type: data.eventType,
        payload: data.payload as any,
      })
      .onConflict((oc) => oc.column("id").doNothing())
      .returning("id")
      .executeTakeFirst();

    return result !== undefined;
  }
  // Helpers
  private async loadOrderIds(
    paymentId: string,
    db: DbOrTrx = this.client,
  ): Promise<string[]> {
    const rows = await db
      .selectFrom("orders")
      .select("id")
      .where("payment_id", "=", paymentId)
      .execute();

    return rows.map((r) => r.id);
  }
}
