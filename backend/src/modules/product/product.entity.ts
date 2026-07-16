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
    public readonly images: ReadonlyArray<string>,
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

  /**
   * Main / thumbnail image for catalog cards. First gallery image wins;
   * fall back to the first active variant image, then `null`.
   */
  getMainImageUrl(): string | null {
    if (this.images.length > 0) return this.images[0];
    const variant = this.variants.find((v) => v.isActive) ?? this.variants[0];
    return variant?.imageUrl ?? null;
  }

  /**
   * The image list we actually serve to clients.
   *
   * Two modes:
   *
   *   1. **Legacy mode** — the product was created *before* the multi-image
   *      rollout, so `images[]` is still empty. We synthesize a gallery
   *      by appending every variant's `imageUrl`, preserving stored
   *      order first, then de-duplicating by URL.
   *
   *   2. **Authored mode** — the seller has touched the gallery at least
   *      once (via the dashboard's PUT /images endpoint or via a variant
   *      create). In this mode `images[]` is the source of truth; we
   *      must **NOT** re-inject variant imageUrls because that would
   *      make "delete image" a no-op on the storefront: the deleted URL
   *      would come right back through the variant fallback.
   *
   * Read-only — returns a fresh array per call so consumers can mutate.
   */
  getEffectiveImages(): string[] {
    const stored = [...this.images];
    // Authored mode: trust the seller's `images[]` exactly. No variant
    // fallback. This is the fix for the "I deleted an image and it came
    // back after refresh" bug.
    if (stored.length > 0) return stored;

    // Legacy mode: synthesize a gallery from variant imageUrls only.
    const seen = new Set<string>();
    const out: string[] = [];
    for (const variant of this.variants) {
      if (!variant.imageUrl) continue;
      if (seen.has(variant.imageUrl)) continue;
      seen.add(variant.imageUrl);
      out.push(variant.imageUrl);
    }
    return out;
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
      // Prisma returns the array as Prisma.JsonValue / string[] depending
      // on driver version; normalize defensively.
      Array.isArray(row.images)
        ? (row.images as string[])
        : row.images && typeof row.images === "object"
          ? Object.values(row.images as Record<string, string>)
          : [],
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
      categoryId: this.categoryId,
      name: this.name,
      slug: this.slug,
      basePrice: this.basePrice,
      minPrice: this.getMinPrice(),
      maxPrice: this.getMaxPrice(),
      isActive: this.isActive,
      // Main image now reads from `images[]` first, variant image as
      // fallback. The dashboard cells / storefront cards consume this.
      imageUrl: this.getMainImageUrl(),
      images: [...this.images],
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
      // `getEffectiveImages()` flattens legacy variant imageUrls into
      // the gallery so pre-migration products still render a populated
      // gallery on the storefront. New uploads persist straight into
      // `images[]` and skip the fallback.
      images: this.getEffectiveImages(),
      // Convenience: also surface `imageUrl` for screens that only need
      // the primary image (matches old single-image contract).
      imageUrl: this.getMainImageUrl(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      variants: this.variants.map((v) => v.toPublic()),
    };
  }
}
