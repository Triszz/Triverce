import type { Review } from "@prisma/client";

/**
 * Shape of the buyer's review payload that the storefront exposes.
 *
 * The wire format intentionally excludes the raw `userId` (so a buyer
 * can't scrape another buyer's user id from the public review list) and
 * keeps `orderItemId` (so the buyer-side "Write a Review" flow can
 * detect a duplicate submission before showing the form). Everything
 * else is safe to render on a public product page.
 */
export interface ReviewAuthorPublic {
  id: string;
  /** Display name — falls back to a masked email if the user has no full name. */
  name: string;
  /** Gravatar-style avatar URL. May be null if the user hasn't set one. */
  avatarUrl: string | null;
}

export interface ReviewVariantDescriptor {
  id: string;
  sku: string;
  /** Rendered as `Color: Red, Size: M` on the storefront card. */
  attributes: Array<{ name: string; value: string }>;
}

export class ReviewEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly productId: string,
    public readonly variantId: string,
    public readonly orderItemId: string,
    public readonly rating: number,
    public readonly comment: string | null,
    public readonly mediaUrls: ReadonlyArray<string>,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    /** Populated when the repository includes the related user. */
    public readonly author: ReviewAuthorPublic | null = null,
    /** Populated when the repository includes the related variant. */
    public readonly variant: ReviewVariantDescriptor | null = null,
  ) {
    if (rating < 1 || rating > 5) {
      throw new Error(`Review rating must be 1-5, got ${rating}`);
    }
  }

  static fromDatabase(
    row: Review,
    author: ReviewAuthorPublic | null = null,
    variant: ReviewVariantDescriptor | null = null,
  ): ReviewEntity {
    return new ReviewEntity(
      row.id,
      row.userId,
      row.productId,
      row.variantId,
      row.orderItemId,
      row.rating,
      row.comment,
      Array.isArray(row.mediaUrls) ? (row.mediaUrls as string[]) : [],
      row.createdAt,
      row.updatedAt,
      author,
      variant,
    );
  }

  toPublic() {
    return {
      id: this.id,
      productId: this.productId,
      rating: this.rating,
      comment: this.comment,
      mediaUrls: [...this.mediaUrls],
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      // Flatten `author` into the wire shape so the frontend doesn't
      // need to know the entity's internal "author" key.
      author: this.author ?? {
        id: this.userId,
        name: 'Anonymous',
        avatarUrl: null,
      },
      // Same flattening for the variant — the UI needs `variant.attributes`
      // to render "Color: Red, Size: M", so we expose the already-shaped
      // descriptor directly.
      variant: this.variant ?? {
        id: this.variantId,
        sku: '',
        attributes: [],
      },
    };
  }
}

/**
 * Stats payload returned alongside the paginated list. Computed by the
 * repository in two queries (count per rating + count(hasComment) +
 * count(hasMedia)) and merged here so the wire format is one object.
 *
 * All counts are computed against the unfiltered `productId` (i.e. NOT
 * filtered by `rating` / `hasComment` / `hasMedia`) — that way the UI
 * can show the "5★: 12 / 4★: 3 / …" breakdown regardless of which
 * review-pill the user has selected. This matches industry-standard
 * review-summary UIs (Amazon, Shopee, etc.).
 */
export interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  /** Bucketed counts, keyed by the star rating as a string ("1"…"5"). */
  starCounts: { "1": number; "2": number; "3": number; "4": number; "5": number };
  withComments: number;
  withMedia: number;
}