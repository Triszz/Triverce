import { ProductVariantWithStock } from "../../infrastructure/database/db.schema";
export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

const LOW_STOCK_THRESHOLD = 5;
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
    public readonly available?: number,
  ) {
    if (price < 0) {
      throw new Error("Variant price cannot be negative");
    }
  }

  // Business rules
  get stockStatus(): StockStatus {
    if (this.available === undefined) return "in_stock";
    if (this.available <= 0) return "out_of_stock";
    if (this.available <= LOW_STOCK_THRESHOLD) return "low_stock";
    return "in_stock";
  }
  isAvailable(): boolean {
    return this.isActive && this.stockStatus !== "out_of_stock";
  }

  getAttributeValue(attributeName: string): string | null {
    const attr = this.attributes.find(
      (a) => a.attributeName.toLowerCase() === attributeName.toLowerCase(),
    );
    return attr?.value ?? null;
  }

  isSimpleVariant(): boolean {
    return this.attributes.length === 0;
  }

  static fromDatabase(
    row: ProductVariantWithStock,
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
      row.available != null ? Number(row.available) : undefined,
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
      stockStatus: this.stockStatus,
    };
  }
}
