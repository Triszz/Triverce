import type { ProductVariant } from "@prisma/client";

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

const LOW_STOCK_THRESHOLD = 5;

export interface VariantAttribute {
  attributeId: string;
  attributeName: string;
  value: string;
}

/**
 * Row shape produced by the repository's `loadVariantsWithAttributes`
 * helper. It's a `ProductVariant` row joined with an optional `available`
 * number (computed from `inventory.quantity - inventory.reserved`).
 */
export type ProductVariantRowWithStock = ProductVariant & {
  available?: number | null;
};

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
    row: ProductVariantRowWithStock,
    attributes: VariantAttribute[] = [],
  ): ProductVariantEntity {
    return new ProductVariantEntity(
      row.id,
      row.productId,
      row.sku,
      Number(row.price),
      row.imageUrl,
      row.isActive,
      row.createdAt,
      row.updatedAt,
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
      available: this.available,
    };
  }
}
