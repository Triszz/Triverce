import type { PrismaClient, Prisma } from "@prisma/client";
import {
  ReviewEntity,
  type ReviewAuthorPublic,
  type ReviewVariantDescriptor,
  type ReviewStats,
} from "./review.entity";

/**
 * ReviewRepository — Prisma-backed.
 *
 * Public surface mirrors the entity shape: callers work with
 * `ReviewEntity` instances, not raw rows. Composes the include-shapes
 * needed by the storefront (author + variant) so the service layer
 * doesn't need to know Prisma's `include` syntax.
 */
export class ReviewRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Insert a new review. The unique constraint on `order_item_id` is
   * the database-level enforcement of the "one review per delivered
   * order item" rule — Prisma surfaces a P2002 error that the service
   * translates into a 409 Conflict.
   *
   * Returns the created entity with author + variant pre-loaded so the
   * caller can return a complete wire payload without a second round-trip.
   */
  async create(args: {
    userId: string;
    productId: string;
    variantId: string;
    orderItemId: string;
    rating: number;
    comment: string | null;
    mediaUrls: string[];
  }): Promise<ReviewEntity> {
    const row = await this.prisma.review.create({
      data: {
        userId: args.userId,
        productId: args.productId,
        variantId: args.variantId,
        orderItemId: args.orderItemId,
        rating: args.rating,
        comment: args.comment,
        mediaUrls: args.mediaUrls,
      },
    });
    return this.findById(row.id) as Promise<ReviewEntity>;
  }

  /**
   * Load a single review by id, with author + variant pre-joined.
   * Returns `null` when no row matches — callers decide whether that's
   * a 404 or a different error code.
   */
  async findById(id: string): Promise<ReviewEntity | null> {
    const row = await this.prisma.review.findUnique({
      where: { id },
      include: this.fullInclude(),
    });
    if (!row) return null;
    return ReviewEntity.fromDatabase(
      row,
      this.toAuthor(row.user),
      this.toVariant(row.variant),
    );
  }

  /**
   * List reviews for a product with optional filters + pagination.
   * Used by `GET /api/reviews/product/:productId`.
   */
  async listByProduct(args: {
    productId: string;
    rating?: number;
    hasComment?: boolean;
    hasMedia?: boolean;
    page: number;
    limit: number;
  }): Promise<{ data: ReviewEntity[]; total: number }> {
    const where: Prisma.ReviewWhereInput = { productId: args.productId };
    if (args.rating !== undefined) where.rating = args.rating;
    if (args.hasComment === true) where.comment = { not: null };
    if (args.hasComment === false) where.comment = null;
    // `hasMedia` is true when `mediaUrls` is a non-empty array. Postgres
    // array operators are not directly expressible in Prisma's `where`,
    // so we use a raw query-equivalent: `array_length(media_urls, 1) > 0`.
    // For "false" we just match the default empty array OR an array of length 0.
    // In practice this filter is rarely false-only, so the raw approach
    // is fine.
    if (args.hasMedia === true) {
      where.mediaUrls = { isEmpty: false };
    } else if (args.hasMedia === false) {
      where.mediaUrls = { equals: [] };
    }

    const [total, rows] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (args.page - 1) * args.limit,
        take: args.limit,
        include: this.fullInclude(),
      }),
    ]);

    const data = rows.map((row) =>
      ReviewEntity.fromDatabase(
        row,
        this.toAuthor(row.user),
        this.toVariant(row.variant),
      ),
    );
    return { data, total };
  }

  /**
   * Compute the stats payload for a product. Always runs against the
   * unfiltered set so the breakdown is stable regardless of which
   * review pill is active.
   *
   * Two round-trips:
   *   1. SELECT rating, COUNT(*) GROUP BY rating  →  star counts + total
   *   2. SELECT COUNT(*) WHERE comment IS NOT NULL / media_urls != '{}'
   *
   * For a busy product with 10k reviews this stays sub-millisecond
   * because the (product_id, rating) composite index from the migration
   * covers the GROUP BY scan.
   */
  async getStatsByProduct(productId: string): Promise<ReviewStats> {
    const [ratingRows, withComments, withMedia] = await Promise.all([
      this.prisma.review.groupBy({
        by: ["rating"],
        where: { productId },
        _count: { _all: true },
      }),
      this.prisma.review.count({
        where: { productId, NOT: { comment: null } },
      }),
      this.prisma.review.count({
        where: { productId, NOT: { mediaUrls: { equals: [] } } },
      }),
    ]);

    const starCounts: ReviewStats["starCounts"] = {
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 0,
    };
    let totalReviews = 0;
    let weightedSum = 0;
    for (const row of ratingRows) {
      const count = row._count._all;
      starCounts[String(row.rating) as "1" | "2" | "3" | "4" | "5"] = count;
      totalReviews += count;
      weightedSum += row.rating * count;
    }
    const averageRating =
      totalReviews > 0
        ? // Round to 1 decimal place so the UI renders as "4.8" rather
          // than "4.800000000000001". Multiplication-then-round avoids
          // floating-point drift over many reviews.
          Math.round((weightedSum / totalReviews) * 10) / 10
        : 0;

    return {
      averageRating,
      totalReviews,
      starCounts,
      withComments,
      withMedia,
    };
  }

  /**
   * Check whether a review already exists for the given order item.
   * Used by the service before INSERT so it can return a clean 409
   * with a friendly message (the unique constraint also catches this,
   * but the explicit check gives us a stable error code path that
   * doesn't depend on Prisma's P2002 string).
   */
  async existsForOrderItem(orderItemId: string): Promise<boolean> {
    const found = await this.prisma.review.findUnique({
      where: { orderItemId },
      select: { id: true },
    });
    return found !== null;
  }

  /**
   * Single include-shape used by all read paths so the author + variant
   * joins look identical everywhere. Centralised so adding a new field
   * to the wire payload is a one-liner.
   */
  private fullInclude() {
    return {
      user: {
        select: {
          id: true,
          fullName: true,
          // No avatarUrl on the User model today — we may add it later
          // (mirroring the storefront's user-avatar pattern), so the
          // entity already has the field. For now we return null so the
          // frontend shows the initial-letter fallback it uses elsewhere.
        },
      },
      variant: {
        select: {
          id: true,
          sku: true,
          attributeValues: {
            select: {
              value: true,
              attribute: { select: { name: true } },
            },
          },
        },
      },
    } satisfies Prisma.ReviewInclude;
  }

  private toAuthor(user: {
    id: string;
    fullName: string;
  } | undefined): ReviewAuthorPublic | null {
    if (!user) return null;
    // The User table doesn't currently carry an avatar URL column, so
    // we surface `fullName` as the display name and `null` for the URL.
    // When an avatar column is added, populate it here.
    const name = user.fullName?.trim() || 'Anonymous';
    return { id: user.id, name, avatarUrl: null };
  }

  private toVariant(
    variant:
      | {
          id: string;
          sku: string;
          attributeValues: Array<{
            value: string;
            attribute: { name: string };
          }>;
        }
      | undefined,
  ): ReviewVariantDescriptor | null {
    if (!variant) return null;
    return {
      id: variant.id,
      sku: variant.sku,
      // Sort attributes alphabetically by name so the rendered string
      // "Color: Red, Size: M" is deterministic regardless of how the
      // seller set them up.
      attributes: [...variant.attributeValues]
        .sort((a, b) =>
          a.attribute.name.localeCompare(b.attribute.name, 'en'),
        )
        .map((av) => ({ name: av.attribute.name, value: av.value })),
    };
  }
}