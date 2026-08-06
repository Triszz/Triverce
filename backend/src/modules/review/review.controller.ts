import { Request, Response, NextFunction } from "express";
import { ReviewService } from "./review.service";
import {
  CreateReviewDto,
  ListReviewsByProductQuery,
} from "./review.dto";

/**
 * ReviewController — thin HTTP layer over `ReviewService`.
 *
 * All business logic lives in the service. The controller's job is to
 * (a) translate `(req.body, req.user, req.params, req.query)` into
 * typed service arguments, and (b) wrap the result in the standard
 * `{ success: true, data: ... }` envelope used elsewhere in this API.
 */
export class ReviewController {
  constructor(private reviewService: ReviewService) {}

  /**
   * POST /api/reviews — buyer submits a review for a delivered order
   * item. Authentication required, customer role only.
   *
   * Validation is handled by the Zod middleware mounted on the route;
   * by the time we reach this handler `req.body` is fully typed.
   */
  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const review = await this.reviewService.create(
        req.user!.userId,
        req.body as CreateReviewDto,
      );
      res.status(201).json({
        success: true,
        data: review.toPublic(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/reviews/product/:productId — public list with filters +
   * stats payload. No authentication required (reviews are public on
   * the storefront).
   */
  listByProduct = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.reviewService.listByProduct(
        req.params.productId as string,
        // The `validateQuery` middleware rewrites `req.query` to the
        // parsed Zod output, so this is the typed shape.
        req.query as unknown as ListReviewsByProductQuery,
      );
      res.status(200).json({
        success: true,
        data: result.data.map((r) => r.toPublic()),
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
        },
        // Stats sit on a top-level `stats` key rather than inside `meta`
        // because they're a sibling concern: pagination metadata is
        // about THIS page, while stats describe the whole product. Putting
        // them side-by-side keeps the wire format predictable.
        stats: result.stats,
      });
    } catch (error) {
      next(error);
    }
  };
}