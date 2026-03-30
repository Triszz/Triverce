import { ProductRow } from "../../infrastructure/database/db.schema";
import { ProductVariantEntity } from "./product-variant.entity";

export class ProductEntity {
  constructor(
    public readonly id: string,
    public readonly categoryId: string | null,
    public readonly name: string,
    public readonly slug: string,
    public readonly description: string | null,
    public readonly basePrice: number,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly variants: ReadonlyArray<ProductVariantEntity> = [],
  ) {
    if (basePrice < 0) {
      throw new Error("Product base price cannot be negative");
    }
  }

  // Business rules
  isAvailableForSale(): boolean {
    return this.isActive && this.hasActiveVariants();
  }

  hasActiveVariants(): boolean {
    if (this.variants.length === 0) return false;
    return this.variants.some((v) => v.isActive);
  }

  getMinPrice(): number {
    if (this.variants.length === 0) return this.basePrice;
    const prices = this.variants.filter((v) => v.isActive).map((v) => v.price);
    return prices.length > 0 ? Math.min(...prices) : this.basePrice;
  }

  getMaxPrice(): number {
    if (this.variants.length === 0) return this.basePrice;
    const prices = this.variants.filter((v) => v.isActive).map((v) => v.price);
    return prices.length > 0 ? Math.max(...prices) : this.basePrice;
  }

  static fromDatabase(
    row: ProductRow,
    variants: ProductVariantEntity[] = [],
  ): ProductEntity {
    return new ProductEntity(
      row.id,
      row.category_id,
      row.name,
      row.slug,
      row.description,
      row.base_price,
      row.is_active,
      new Date(row.created_at),
      new Date(row.updated_at),
      variants,
    );
  }

  // Response for List Page
  toPublicSummary() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      basePrice: this.basePrice,
      minPrice: this.getMinPrice(),
      maxPrice: this.getMaxPrice(),
      isActive: this.isActive,
    };
  }

  // Response for Detail Page
  toPublicDetail() {
    return {
      id: this.id,
      categoryId: this.categoryId,
      name: this.name,
      slug: this.slug,
      description: this.description,
      basePrice: this.basePrice,
      minPrice: this.getMinPrice(),
      maxPrice: this.getMaxPrice(),
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      variants: this.variants.map((v) => v.toPublic()),
    };
  }
}
