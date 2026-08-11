import type { CartItem, Inventory, ProductVariant, Product } from "@prisma/client";

export class CartItemEntity {
  constructor(
    public readonly id: string,
    public readonly cartId: string,
    public readonly variantId: string,
    public readonly quantity: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,

    // Information joined from product_variants + products to display
    public readonly variantSku?: string,
    public readonly variantPrice?: number,
    public readonly productName?: string,
    public readonly productSlug?: string,
    public readonly variantImageUrl?: string | null,

    // Inventory for stock-limit UI
    public readonly inventoryQuantity?: number,
    public readonly inventoryReserved?: number,

    // Storefront grouping (multi-vendor cart). Populated from the
    // joined `product` row so the buyer UI can group items by store
    // without re-fetching each variant's product. `storeName` is
    // optional because sellers may not have set one yet.
    public readonly sellerId?: string,
    public readonly storeName?: string | null,
  ) {}

  /** Quantity available to the customer (total minus reserved). */
  get availableStock(): number {
    const qty = this.inventoryQuantity ?? 0;
    const reserved = this.inventoryReserved ?? 0;
    const available = qty - reserved;
    return available > 0 ? available : 0;
  }

  get subtotal(): number {
    return (this.variantPrice ?? 0) * this.quantity;
  }

  /**
   * Adapter from a plain `CartItem` (no joins).
   * Used for transactional write paths that don't need display fields.
   */
  static fromRow(row: CartItem): CartItemEntity {
    return new CartItemEntity(
      row.id,
      row.cartId,
      row.variantId,
      row.quantity,
      row.createdAt,
      row.updatedAt,
    );
  }

  /**
   * Adapter from a `CartItem` row joined with variant + product details.
   * Fields with `| null | undefined` come from optional joins.
   *
   * `sellerStoreName` is passed separately rather than typed on the
   * `product` row because the Prisma `Product` model doesn't expose
   * the seller relationship here — the join to `product.seller` is
   * layered in `cart.repository.ts` so the entity stays Prisma-agnostic.
   */
  static fromDatabase(
    row: CartItem & {
      variant?: ProductVariant | null;
      variantProduct?: Product | null;
      inventoryQuantity?: number | null;
      inventoryReserved?: number | null;
      /** `product.seller.storeName` — passed through by the repository. */
      sellerStoreName?: string | null;
    },
  ): CartItemEntity {
    const variant = row.variant ?? null;
    const product = row.variantProduct ?? null;
    return new CartItemEntity(
      row.id,
      row.cartId,
      row.variantId,
      row.quantity,
      row.createdAt,
      row.updatedAt,
      variant?.sku,
      variant ? Number(variant.price) : undefined,
      product?.name,
      product?.slug,
      variant?.imageUrl,
      row.inventoryQuantity ?? undefined,
      row.inventoryReserved ?? undefined,
      // `sellerId` comes from the product row (FK on the product),
      // `storeName` is pulled from the joined seller record.
      product?.sellerId,
      row.sellerStoreName ?? null,
    );
  }

  toPublic() {
    return {
      id: this.id,
      variantId: this.variantId,
      quantity: this.quantity,
      sku: this.variantSku,
      price: this.variantPrice,
      productName: this.productName,
      productSlug: this.productSlug,
      imageUrl: this.variantImageUrl,
      subtotal: this.subtotal,
      availableStock: this.availableStock,
      // Multi-vendor grouping fields. Both are optional in the
      // cart-item entity so previously-created carts (or items
      // whose product row couldn't be joined) survive the upgrade
      // without breaking the public API.
      sellerId: this.sellerId,
      storeName: this.storeName,
      updatedAt: this.updatedAt,
    };
  }
}
