import { OrderStatusLogRow } from "../../infrastructure/database/db.schema";

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

  static fromDatabase(row: OrderStatusLogRow): OrderStatusLogEntity {
    return new OrderStatusLogEntity(
      row.id,
      row.order_id,
      row.from_status,
      row.to_status,
      row.changed_by,
      row.note,
      new Date(row.created_at),
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
