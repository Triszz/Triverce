import type { Product } from "@prisma/client";

export class ProductEntity {
  constructor(
    public readonly id: string,
    public readonly sellerId: string,
    public readonly categoryId: string | null,
    public readonly name: string,
    public readonly slug: string,
    public readonly description: string | null,
    public readonly basePrice: number,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly variants: ReadonlyArray<import("./product-variant.entity").ProductVariantEntity> = [],
  ) {
    if (basePrice < 0) {
      throw new Error("Product base price cannot be negative");
    }
  }

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

  isSimpleProduct(): boolean {
    return this.variants.length === 1 && this.variants[0].isSimpleVariant();
  }

  static fromDatabase(
    row: Product,
    variants: import("./product-variant.entity").ProductVariantEntity[] = [],
  ): ProductEntity {
    return new ProductEntity(
      row.id,
      row.sellerId,
      row.categoryId,
      row.name,
      row.slug,
      row.description,
      Number(row.basePrice),
      row.isActive,
      row.createdAt,
      row.updatedAt,
      variants,
    );
  }

  toPublicSummary() {
    return {
      id: this.id,
      sellerId: this.sellerId,
      name: this.name,
      slug: this.slug,
      basePrice: this.basePrice,
      minPrice: this.getMinPrice(),
      maxPrice: this.getMaxPrice(),
      isActive: this.isActive,
    };
  }

  toPublicDetail() {
    return {
      id: this.id,
      sellerId: this.sellerId,
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
