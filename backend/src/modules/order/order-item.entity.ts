import type { OrderItem } from "@prisma/client";

/**
 * Shape we expect from `loadItems` when it `include`s the variant
 * relation. Kept local so the entity doesn't depend on the full
 * Prisma include type (which has many other fields).
 */
export interface OrderItemVariantPayload {
  /** `product_variants.image_url` — denormalized onto the order item
   *  so the seller dashboard doesn't need a second round-trip per item. */
  imageUrl: string | null;
  /** Resolved `{ name, value }` pairs, e.g.
   *  `[{ name: "color", value: "Red" }, { name: "size", value: "M" }]`. */
  attributeValues: Array<{
    value: string;
    attribute: { name: string };
  }>;
  /**
   * Product slug — used by the buyer order-detail page to deep-link
   * the product name back to `/product/:slug`. `null` for items
   * whose variant.product was deleted (the relation has
   * `onDelete: Restrict`, so this is rare).
   */
  productSlug: string | null;
}

/**
 * Human-friendly attribute pair — what the frontend renders in the
 * order detail page. Names are lower-cased by the backend's
 * variant module on write; we preserve them as-is.
 */
export interface OrderItemAttribute {
  name: string;
  value: string;
}

export class OrderItemEntity {
  constructor(
    public readonly id: string,
    public readonly orderId: string,
    public readonly variantId: string,
    public readonly quantity: number,
    public readonly unitPrice: number,
    public readonly productName: string,
    public readonly variantSku: string,
    /** Resolved variant image + attribute values. May be `null`/empty
     *  for legacy rows or for variants that were deleted from the
     *  catalog but kept on the order (the variant relation uses
     *  `onDelete: Restrict` so this is rare). */
    public readonly imageUrl: string | null,
    public readonly attributes: OrderItemAttribute[],
    public readonly createdAt: Date,
    /**
     * Product slug for deep-linking in the buyer order-detail page.
     * `null` when the variant's product was deleted (rare, due to
     * `onDelete: Restrict`).
     */
    public readonly productSlug: string | null,
  ) {}

  get subtotal(): number {
    return this.unitPrice * this.quantity;
  }

  static fromDatabase(
    row: OrderItem,
    variant: OrderItemVariantPayload = {
      imageUrl: null,
      attributeValues: [],
      productSlug: null,
    },
  ): OrderItemEntity {
    return new OrderItemEntity(
      row.id,
      row.orderId,
      row.variantId,
      row.quantity,
      Number(row.unitPrice),
      row.productName,
      row.variantSku,
      variant.imageUrl,
      variant.attributeValues.map((a) => ({
        name: a.attribute.name,
        value: a.value,
      })),
      row.createdAt,
      variant.productSlug,
    );
  }

  toPublic() {
    return {
      id: this.id,
      variantId: this.variantId,
      productName: this.productName,
      variantSku: this.variantSku,
      quantity: this.quantity,
      unitPrice: this.unitPrice,
      subtotal: this.subtotal,
      imageUrl: this.imageUrl,
      attributes: this.attributes,
      productSlug: this.productSlug,
    };
  }
}
