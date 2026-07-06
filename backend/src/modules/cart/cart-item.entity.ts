import type { CartItem, ProductVariant, Product } from "@prisma/client";

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
  ) {}

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
   */
  static fromDatabase(
    row: CartItem & {
      variant?: ProductVariant | null;
      variantProduct?: Product | null;
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
      updatedAt: this.updatedAt,
    };
  }
}
