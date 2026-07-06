import type { OrderStatusLog } from "@prisma/client";

export class OrderStatusLogEntity {
  constructor(
    public readonly id: string,
    public readonly orderId: string,
    public readonly fromStatus: string | null,
    public readonly toStatus: string,
    public readonly changedBy: string | null,
    public readonly note: string | null,
    public readonly createdAt: Date,
  ) {}

  static fromDatabase(row: OrderStatusLog): OrderStatusLogEntity {
    return new OrderStatusLogEntity(
      row.id,
      row.orderId,
      row.fromStatus,
      row.toStatus,
      row.changedBy,
      row.note,
      row.createdAt,
    );
  }

  toPublic() {
    return {
      fromStatus: this.fromStatus,
      toStatus: this.toStatus,
      changedBy: this.changedBy,
      note: this.note,
      createdAt: this.createdAt,
    };
  }
}
