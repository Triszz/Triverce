import { OrderRow } from "../../infrastructure/database/db.schema";
import { OrderItemEntity } from "./order-item.entity";
import { OrderStatusLogEntity } from "./order-status-log.entity";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipping"
  | "delivered"
  | "cancelled"
  | "failed";

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
    row: OrderRow,
    items: OrderItemEntity[] = [],
    statusLogs: OrderStatusLogEntity[] = [],
  ): OrderEntity {
    return new OrderEntity(
      row.id,
      row.customer_id,
      row.seller_id,
      row.status,
      Number(row.total_amount),
      row.shipping_name,
      row.shipping_phone,
      row.shipping_address,
      row.note,
      row.cancelled_reason,
      items,
      statusLogs,
      new Date(row.created_at),
      new Date(row.updated_at),
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
      items: this.items.map((i) => i.toPublic()),
      statusLogs: this.statusLogs.map((l) => l.toPublic()),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
