import { PaymentRow } from "../../infrastructure/database/db.schema";

export type PaymentStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded";

export type PaymentGateway = "momo" | "stripe" | "vnpay" | "cod";

export class PaymentEntity {
  constructor(
    public readonly id: string,
    public readonly customerId: string,
    public readonly amount: number,
    public readonly currency: string,
    public status: PaymentStatus,
    public readonly gateway: PaymentGateway,
    public gatewayRef: string | null,
    public gatewayData: unknown | null,
    public readonly idempotencyKey: string,
    public readonly orderIds: string[],
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  canTransitionTo(next: PaymentStatus): boolean {
    const allowed: Record<PaymentStatus, PaymentStatus[]> = {
      pending: ["processing", "paid", "cancelled", "failed"],
      processing: ["paid", "failed", "cancelled"],
      paid: ["refunded"],
      failed: [],
      cancelled: [],
      refunded: [],
    };

    return allowed[this.status].includes(next);
  }

  canBeRefunded(): boolean {
    return this.status === "paid";
  }

  isPaid(): boolean {
    return this.status === "paid";
  }

  static fromDatabase(row: PaymentRow, orderIds: string[]): PaymentEntity {
    return new PaymentEntity(
      row.id,
      row.customer_id,
      Number(row.amount),
      row.currency,
      row.status,
      row.gateway,
      row.gateway_ref,
      row.gateway_data,
      row.idempotency_key,
      orderIds,
      new Date(row.created_at),
      new Date(row.updated_at),
    );
  }

  toPublic() {
    return {
      id: this.id,
      amount: this.amount,
      currency: this.currency,
      status: this.status,
      gateway: this.gateway,
      orderIds: this.orderIds,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
