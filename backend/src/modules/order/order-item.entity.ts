import type { OrderItem } from "@prisma/client";

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

  static fromDatabase(row: OrderItem): OrderItemEntity {
    return new OrderItemEntity(
      row.id,
      row.orderId,
      row.variantId,
      row.quantity,
      Number(row.unitPrice),
      row.productName,
      row.variantSku,
      row.createdAt,
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
