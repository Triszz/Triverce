import type { Inventory } from "@prisma/client";

export class InventoryEntity {
  constructor(
    public readonly id: string,
    public readonly variantId: string,
    public readonly quantity: number,
    public readonly reserved: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  get available(): number {
    const calc = this.quantity - this.reserved;
    return calc > 0 ? calc : 0;
  }

  get isInStock(): boolean {
    return this.available > 0;
  }

  static fromDatabase(row: Inventory): InventoryEntity {
    return new InventoryEntity(
      row.id,
      row.variantId,
      row.quantity,
      row.reserved,
      row.createdAt,
      row.updatedAt,
    );
  }

  toPublic() {
    return {
      id: this.id,
      variantId: this.variantId,
      quantity: this.quantity,
      reserved: this.reserved,
      available: this.available,
      isInStock: this.isInStock,
      updatedAt: this.updatedAt,
    };
  }
}
