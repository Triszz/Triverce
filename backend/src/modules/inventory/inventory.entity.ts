import { InventoryRow } from "../../infrastructure/database/db.schema";

export class InventoryEntity {
  constructor(
    public readonly id: string,
    public readonly variantId: string,
    public readonly quantity: number,
    public readonly reserved: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  // Business rules
  get available(): number {
    const calc = this.quantity - this.reserved;
    return calc > 0 ? calc : 0;
  }

  get isInStock(): boolean {
    return this.available > 0;
  }

  static fromDatabase(row: InventoryRow): InventoryEntity {
    return new InventoryEntity(
      row.id,
      row.variant_id,
      row.quantity,
      row.reserved,
      new Date(row.created_at),
      new Date(row.updated_at),
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
