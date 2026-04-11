import {
  CartItemWithDetails,
  CartItemRow,
} from "../../infrastructure/database/db.schema";

export class CartItemEntity {
  constructor(
    public readonly id: string,
    public readonly cartId: string,
    public readonly variantId: string,
    public readonly quantity: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,

    // Information join from product_variants + products to display
    public readonly variantSku?: string,
    public readonly variantPrice?: number,
    public readonly productName?: string,
    public readonly productSlug?: string,
    public readonly variantImageUrl?: string | null,
  ) {}

  get subtotal(): number {
    return (this.variantPrice ?? 0) * this.quantity;
  }

  static fromRow(row: CartItemRow): CartItemEntity {
    return new CartItemEntity(
      row.id,
      row.cart_id,
      row.variant_id,
      row.quantity,
      new Date(row.created_at),
      new Date(row.updated_at),
    );
  }

  static fromDatabase(row: CartItemWithDetails): CartItemEntity {
    return new CartItemEntity(
      row.id,
      row.cart_id,
      row.variant_id,
      row.quantity,
      new Date(row.created_at),
      new Date(row.updated_at),
      row.variant_sku,
      row.variant_price,
      row.product_name,
      row.product_slug,
      row.variant_image_url,
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
