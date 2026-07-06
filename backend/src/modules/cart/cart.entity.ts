import { CartItemEntity } from "./cart-item.entity";
import type { Cart } from "@prisma/client";

export type CartStatus = "active" | "checked_out" | "abandoned";

export class CartEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly status: CartStatus,
    public readonly items: CartItemEntity[],
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  get totalItems(): number {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  get totalPrice(): number {
    return this.items.reduce((sum, item) => sum + item.subtotal, 0);
  }

  static fromDatabase(row: Cart, items: CartItemEntity[]): CartEntity {
    return new CartEntity(
      row.id,
      row.userId,
      row.status,
      items,
      row.createdAt,
      row.updatedAt,
    );
  }

  toPublic() {
    return {
      id: this.id,
      status: this.status,
      items: this.items.map((i) => i.toPublic()),
      totalItems: this.totalItems,
      totalPrice: this.totalPrice,
      updatedAt: this.updatedAt,
    };
  }
}
