import { OrderItemRow } from "../../infrastructure/database/db.schema";

export class OrderItemEntity {
  constructor(
    public readonly id: string,
    public readonly orderId: string,
    public readonly variantId: string,
    public readonly quantity: number,
    public readonly unitPrice: number,
    public readonly productName: string,
    public readonly variantSku: string,
    public readonly createdAt: Date,
  ) {}

  get subtotal(): number {
    return this.unitPrice * this.quantity;
  }

  static fromDatabase(row: OrderItemRow): OrderItemEntity {
    return new OrderItemEntity(
      row.id,
      row.order_id,
      row.variant_id,
      row.quantity,
      Number(row.unit_price),
      row.product_name,
      row.variant_sku,
      new Date(row.created_at),
    );
  }

  toPublic() {
    return {
      id: this.id,
      variantId: this.variantId,
      productName: this.productName,
      variantSku: this.variantSku,
      quantity: this.quantity,
      unitPrice: this.unitPrice,
      subtotal: this.subtotal,
    };
  }
}
