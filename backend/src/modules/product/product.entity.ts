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
    /** Populated at query time via Prisma `include: { seller: { select: { storeName: true } } }`. */
    public readonly storeName: string | null = null,
    /** Populated at query time via Prisma `include: { category: { select: { id: true, name: true } } }`. */
    public readonly category: { id: string; name: string } | null = null,
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

    // Always deduplicate, regardless of mode. Duplicates can creep in from:
    //   • Legacy data where variant imageUrls were wrongly appended to `images[]`.
    //   • Seed / migration scripts that naively merged two lists.
    const seen = new Set<string>();
    const out: string[] = [];
    for (const url of stored) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push(url);
    }

    // Authored mode: deduplicated `images[]` is the final answer.
    if (out.length > 0) return out;

    // Legacy mode: synthesize a gallery from variant imageUrls only.
    for (const variant of this.variants) {
      if (!variant.imageUrl || seen.has(variant.imageUrl)) continue;
      seen.add(variant.imageUrl);
      out.push(variant.imageUrl);
    }
    return out;
  }

  static fromDatabase(
    row: Product,
    variants: import("./product-variant.entity").ProductVariantEntity[] = [],
    storeName: string | null = null,
    category: { id: string; name: string } | null = null,
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
      storeName,
      category,
    );
  }

  toPublicSummary() {
    return {
      id: this.id,
      sellerId: this.sellerId,
      categoryId: this.categoryId,
      category: this.category ?? undefined,
      name: this.name,
      slug: this.slug,
      basePrice: this.basePrice,
      minPrice: this.getMinPrice(),
      maxPrice: this.getMaxPrice(),
      isActive: this.isActive,
      // Main image now reads from `images[]` first, variant image as
      // fallback. The dashboard cells / storefront cards consume this.
      imageUrl: this.getMainImageUrl(),
      // Use `getEffectiveImages()` so summaries are always deduplicated
      // even when the authored `images[]` contains duplicates.
      images: this.getEffectiveImages(),
      storeName: this.storeName,
    };
  }

  toPublicDetail() {
    return {
      id: this.id,
      sellerId: this.sellerId,
      categoryId: this.categoryId,
      category: this.category ?? undefined,
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
      storeName: this.storeName,
    };
  }
}
