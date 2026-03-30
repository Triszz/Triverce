import { ProductVariantRow } from "../../infrastructure/database/db.schema";

export interface VariantAttribute {
  attributeId: string;
  attributeName: string;
  value: string;
}
export class ProductVariantEntity {
  constructor(
    public readonly id: string,
    public readonly productId: string,
    public readonly sku: string,
    public readonly price: number,
    public readonly imageUrl: string | null,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly attributes: ReadonlyArray<VariantAttribute> = [],
  ) {
    if (price < 0) {
      throw new Error("Variant price cannot be negative");
    }
  }

  // Business rules
  isAvailable(): boolean {
    return this.isActive;
  }

  getAttributeValue(attributeName: string): string | null {
    const attr = this.attributes.find(
      (a) => a.attributeName.toLowerCase() === attributeName.toLowerCase(),
    );
    return attr?.value ?? null;
  }

  static fromDatabase(
    row: ProductVariantRow,
    attributes: VariantAttribute[] = [],
  ): ProductVariantEntity {
    return new ProductVariantEntity(
      row.id,
      row.product_id,
      row.sku,
      row.price,
      row.image_url,
      row.is_active,
      new Date(row.created_at),
      new Date(row.updated_at),
      attributes,
    );
  }

  toPublic() {
    return {
      id: this.id,
      productId: this.productId,
      sku: this.sku,
      price: this.price,
      imageUrl: this.imageUrl,
      isActive: this.isActive,
      attributes: this.attributes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
