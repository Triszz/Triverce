import { z } from "zod";

/**
 * Schema for `POST /api/reviews`.
 *
 * Payload is intentionally minimal — the server looks up the parent
 * `OrderItem` itself based on `orderItemId` + the authenticated user,
 * and validates the "delivered" business rule there. The client only
 * supplies:
 *
 *   • orderItemId — the exact line item they want to review
 *   • rating      — 1..5
 *   • comment     — optional, ≤ 2000 chars
 *   • mediaUrls   — optional, ≤ 5 URLs
 *
 * `orderItemId` is intentionally NOT a UUID-typed Zod field — we want
 * the response to come back from the DB layer if the row is missing,
 * not a 400 with a "must be a valid UUID" message.
 */
export const CreateReviewSchema = z
  .object({
    orderItemId: z.string().min(1, "orderItemId is required"),
    rating: z
      .number({ error: "Rating must be a number" })
      .int("Rating must be a whole number")
      .min(1, "Rating must be at least 1")
      .max(5, "Rating must be at most 5"),
    comment: z
      .string()
      .trim()
      .max(2000, "Comment must be 2000 characters or fewer")
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    // Capped at 5 attachments per review (matches the storefront UI),
    // each ≤ 2048 chars (matches the image-URL validator used elsewhere
    // — relative or absolute URLs both accepted).
    mediaUrls: z
      .array(z.string().min(1).max(2048))
      .max(5, "Maximum of 5 media attachments per review")
      .optional()
      .default([]),
  })
  .transform((data) => ({
    orderItemId: data.orderItemId,
    rating: data.rating,
    comment: data.comment ?? null,
    mediaUrls: data.mediaUrls ?? [],
  }));

/**
 * Schema for `GET /api/reviews/product/:productId` query parameters.
 *
 *   • rating     — optional 1..5 to filter the list to a single bucket.
 *                  Conflicts with `hasComment`/`hasMedia` in the spirit of
 *                  "one filter at a time", but we don't reject combos —
 *                  the UI simply doesn't send them together.
 *   • hasComment — "true" filters to reviews that include a comment.
 *   • hasMedia   — "true" filters to reviews with at least one media URL.
 *   • page/limit — standard pagination (max 50 per page).
 */
export const ListReviewsByProductQuerySchema = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  hasComment: z
    .string()
    .optional()
    .transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined;
    }),
  hasMedia: z
    .string()
    .optional()
    .transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined;
    }),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type CreateReviewDto = z.infer<typeof CreateReviewSchema>;
export type ListReviewsByProductQuery = z.infer<
  typeof ListReviewsByProductQuerySchema
>;