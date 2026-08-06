import { Router } from "express";
import { ReviewController } from "./review.controller";
import { authenticate } from "../../core/middleware/auth.middleware";
import { requireRole } from "../../core/middleware/rbac.middleware";
import { validate, validateQuery } from "../../core/middleware/validate.middleware";
import {
  CreateReviewSchema,
  ListReviewsByProductQuerySchema,
} from "./review.dto";

/**
 * Mount this router at `/api/reviews`.
 *
 *   POST  /api/reviews                  — create review (auth, customer)
 *   GET   /api/reviews/product/:productId — public list + stats
 *
 * The two endpoints are intentionally not nested under `/products/:id`
 * because reviews are a first-class resource of their own (the buyer's
 * `POST /reviews` doesn't have a productId in the URL — the server
 * derives it from the order item).
 */
export const createReviewRouter = (controller: ReviewController) => {
  const router = Router();

  // Public — anyone (even logged-out users) can read product reviews.
  // The route is registered BEFORE the auth-protected POST so it
  // doesn't accidentally get caught by the `/reviews` POST handler
  // (Express dispatches by method, not by order, but listing it first
  // reads more naturally).
  router.get(
    "/product/:productId",
    validateQuery(ListReviewsByProductQuerySchema),
    controller.listByProduct,
  );

  // Customer-only — only buyers can write reviews.
  router.post(
    "/",
    authenticate,
    requireRole("customer"),
    validate(CreateReviewSchema),
    controller.create,
  );

  return router;
};