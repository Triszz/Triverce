import type { Order } from "@prisma/client";
import { OrderItemEntity } from "./order-item.entity";
import { OrderStatusLogEntity } from "./order-status-log.entity";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipping"
  | "delivered"
  | "cancelled"
  | "failed";

/**
 * Re-export the `PaymentStatus` literal union so consumers (frontend
 * types, status-log helpers) can import from a single module without
 * depending on the payment module's internal entity.
 */
export type PaymentMethod = "momo" | "stripe" | "vnpay" | "cod";
export type PaymentState = "pending" | "processing" | "paid" | "failed" | "cancelled" | "refunded";

/**
 * Subset of the `payment` row we expose on the order wire. Kept tight
 * so the repository can build it from a tiny `select` instead of
 * pulling the whole row (gateway data, idempotency key, etc. don't
 * belong on the order payload).
 */
export interface OrderPaymentPayload {
  method: PaymentMethod;
  status: PaymentState;
}

export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled", "failed"],
  confirmed: ["shipping", "cancelled"],
  shipping: ["delivered"],
  delivered: [],
  cancelled: [],
  failed: [],
};

export class OrderEntity {
  constructor(
    public readonly id: string,
    public readonly customerId: string,
    public readonly sellerId: string,
    public readonly status: OrderStatus,
    public readonly totalAmount: number,
    public readonly shippingName: string,
    public readonly shippingPhone: string,
    public readonly shippingAddress: string,
    public readonly note: string | null,
    public readonly cancelledReason: string | null,
    public readonly paymentId: string | null,
    /**
     * Payment method + status. Defaults to `null` for orders without
     * a linked payment row (rare — almost every checkout writes a
     * payment, even for COD). Populated by the repository; the
     * service layer never sets it directly.
     */
    public readonly payment: OrderPaymentPayload | null,
    public readonly items: OrderItemEntity[],
    public readonly statusLogs: OrderStatusLogEntity[],
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  canTransitionTo(nextStatus: OrderStatus): boolean {
    return VALID_TRANSITIONS[this.status].includes(nextStatus);
  }

  canBeCancelledByCustomer(): boolean {
    return this.status === "pending";
  }

  belongsToSeller(sellerId: string): boolean {
    return this.sellerId === sellerId;
  }

  get isFinal(): boolean {
    return this.status === "delivered" || this.status === "cancelled";
  }

  static fromDatabase(
    row: Order,
    items: OrderItemEntity[] = [],
    statusLogs: OrderStatusLogEntity[] = [],
    payment: OrderPaymentPayload | null = null,
  ): OrderEntity {
    return new OrderEntity(
      row.id,
      row.customerId,
      row.sellerId,
      row.status,
      Number(row.totalAmount),
      row.shippingName,
      row.shippingPhone,
      row.shippingAddress,
      row.note,
      row.cancelledReason,
      row.paymentId ?? null,
      payment,
      items,
      statusLogs,
      row.createdAt,
      row.updatedAt,
    );
  }

  toPublic() {
    return {
      id: this.id,
      sellerId: this.sellerId,
      status: this.status,
      totalAmount: this.totalAmount,
      shippingName: this.shippingName,
      shippingPhone: this.shippingPhone,
      shippingAddress: this.shippingAddress,
      note: this.note,
      cancelledReason: this.cancelledReason,
      paymentId: this.paymentId,
      // Issue #3 fix: payment method + status are now exposed so the
      // seller dashboard can render "VNPay - Paid" / "COD - Pending"
      // instead of the old meaningless "Linked" indicator.
      paymentMethod: this.payment?.method ?? null,
      paymentStatus: this.payment?.status ?? null,
      items: this.items.map((i) => i.toPublic()),
      statusLogs: this.statusLogs.map((l) => l.toPublic()),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
