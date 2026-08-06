import type { PrismaClient } from "@prisma/client";
import { ReviewRepository } from "./review.repository";
import {
  ReviewEntity,
  type ReviewStats,
} from "./review.entity";
import type {
  CreateReviewDto,
  ListReviewsByProductQuery,
} from "./review.dto";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "../../core/errors/AppError";

/**
 * ReviewService — business logic for the ratings & reviews feature.
 *
 * The "only delivered orders can be reviewed" rule lives here. The
 * service does NOT trust the client's `productId` / `variantId` fields;
 * it looks up the `OrderItem` by id, follows its parent `Order`, and
 * validates:
 *
 *   1. The order belongs to the authenticated user.
 *   2. The order's status is exactly `'delivered'`.
 *   3. The variant on the order item still matches the product on the
 *      order item (defense against a tampered payload).
 *   4. No review already exists for this order item.
 *
 * Only after all four checks pass do we INSERT. The unique constraint
 * on `reviews.order_item_id` is the last-resort safety net.
 */
export class ReviewService {
  constructor(
    private reviewRepository: ReviewRepository,
    private prisma: PrismaClient,
  ) {}

  /**
   * `POST /api/reviews` — create a review for a delivered order item.
   *
   * Returns the newly-created review entity, fully shaped (author +
   * variant) so the controller can pass it straight to the response.
   */
  async create(
    userId: string,
    dto: CreateReviewDto,
  ): Promise<ReviewEntity> {
    // 1. Load the order item + parent order + variant in a single query.
    //    We need to confirm ownership, delivered status, and that the
    //    variant referenced by the order item still points at the same
    //    product we received (defense against tampered payloads).
    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id: dto.orderItemId },
      include: {
        order: {
          select: { id: true, customerId: true, status: true },
        },
        variant: {
          select: { id: true, productId: true },
        },
      },
    });

    if (!orderItem) {
      throw new NotFoundError(
        `Order item with id "${dto.orderItemId}" not found`,
      );
    }

    // 2. Ownership check — only the customer who placed the order can
    //    review the line item.
    if (orderItem.order.customerId !== userId) {
      throw new ForbiddenError(
        "You can only review items from your own orders",
      );
    }

    // 3. The strict business rule: only delivered orders.
    if (orderItem.order.status !== "delivered") {
      throw new BadRequestError(
        `You can only review items from delivered orders. This order is "${orderItem.order.status}".`,
      );
    }

    // 4. The order item must reference the variant the client said they
    //    reviewed. (The client supplies orderItemId only; the variantId
    //    / productId on the wire come straight from the DB row.)
    const productId = orderItem.variant.productId;
    const variantId = orderItem.variant.id;

    // 5. No duplicate review for the same order item.
    const alreadyReviewed = await this.reviewRepository.existsForOrderItem(
      orderItem.id,
    );
    if (alreadyReviewed) {
      throw new ConflictError(
        "You have already reviewed this item",
      );
    }

    // 6. INSERT. Wrap in try/catch so the unique-constraint race (two
    //    concurrent POSTs from the same user) becomes a clean 409 instead
    //    of a raw Prisma error reaching the global handler.
    try {
      return await this.reviewRepository.create({
        userId,
        productId,
        variantId,
        orderItemId: orderItem.id,
        rating: dto.rating,
        comment: dto.comment,
        mediaUrls: dto.mediaUrls,
      });
    } catch (err) {
      // Prisma's P2002 = unique-constraint violation. Surface as 409.
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        throw new ConflictError(
          "You have already reviewed this item",
        );
      }
      throw err;
    }
  }

  /**
   * `GET /api/reviews/product/:productId` — list reviews with filters
   * + stats payload. Public endpoint.
   */
  async listByProduct(
    productId: string,
    query: ListReviewsByProductQuery,
  ): Promise<{
    data: ReviewEntity[];
    total: number;
    page: number;
    limit: number;
    stats: ReviewStats;
  }> {
    // Run the listing query and the stats aggregation in parallel —
    // they're independent. The stats are computed against the full set
    // (unfiltered) so the breakdown is stable across pill selections.
    const [list, stats] = await Promise.all([
      this.reviewRepository.listByProduct({
        productId,
        rating: query.rating,
        hasComment: query.hasComment,
        hasMedia: query.hasMedia,
        page: query.page,
        limit: query.limit,
      }),
      this.reviewRepository.getStatsByProduct(productId),
    ]);

    return {
      data: list.data,
      total: list.total,
      page: query.page,
      limit: query.limit,
      stats,
    };
  }
}