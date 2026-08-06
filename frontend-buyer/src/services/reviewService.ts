import apiClient from './apiClient';

/* ──────────────────────────────────────────────────────────────────────────
 * Review service — wraps `/api/reviews`.
 *
 * Two endpoints:
 *   • POST /reviews                 — submit a review (auth required)
 *   • GET  /reviews/product/:id     — public list + stats
 *
 * Mirror `review.entity.ts` and `review.dto.ts` on the backend. Field
 * names match exactly so this stays in lock-step with the wire format.
 * ──────────────────────────────────────────────────────────────────────── */

/** 1–5 inclusive, mirrors the backend Zod range. */
export type ReviewRating = 1 | 2 | 3 | 4 | 5;

export interface ReviewVariantDescriptor {
  id: string;
  sku: string;
  attributes: Array<{ name: string; value: string }>;
}

export interface ReviewAuthorPublic {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface ReviewPublic {
  id: string;
  productId: string;
  rating: number;
  comment: string | null;
  mediaUrls: string[];
  createdAt: string;
  updatedAt: string;
  author: ReviewAuthorPublic;
  variant: ReviewVariantDescriptor;
}

export interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  starCounts: {
    '1': number;
    '2': number;
    '3': number;
    '4': number;
    '5': number;
  };
  withComments: number;
  withMedia: number;
}

export interface ListReviewsParams {
  rating?: ReviewRating;
  hasComment?: boolean;
  hasMedia?: boolean;
  page?: number;
  limit?: number;
}

export interface ListReviewsResult {
  data: ReviewPublic[];
  total: number;
  page: number;
  limit: number;
  stats: ReviewStats;
}

export interface CreateReviewPayload {
  orderItemId: string;
  rating: ReviewRating;
  comment?: string;
  mediaUrls?: string[];
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface ApiSuccessWithStats<T> {
  success: true;
  data: T[];
  meta: { total: number; page: number; limit: number };
  stats: ReviewStats;
}

function unwrap<T>(payload: ApiSuccess<T>): T {
  if (!payload.success) throw new Error('Review request failed');
  return payload.data;
}

export const reviewService = {
  /**
   * POST /reviews — buyer submits a review for a delivered order item.
   *
   * `mediaUrls` is capped at 5 client-side as well; the backend Zod
   * schema enforces the same cap so a tampered payload still fails.
   */
  create: async (payload: CreateReviewPayload): Promise<ReviewPublic> => {
    const { data } = await apiClient.post<ApiSuccess<ReviewPublic>>(
      '/reviews',
      {
        orderItemId: payload.orderItemId,
        rating: payload.rating,
        comment: payload.comment,
        mediaUrls: payload.mediaUrls ?? [],
      },
    );
    return unwrap(data);
  },

  /**
   * GET /reviews/product/:productId — public list with filters + stats.
   */
  listByProduct: async (
    productId: string,
    params: ListReviewsParams = {},
  ): Promise<ListReviewsResult> => {
    const { data } = await apiClient.get<ApiSuccessWithStats<ReviewPublic>>(
      `/reviews/product/${encodeURIComponent(productId)}`,
      { params },
    );
    if (!data.success) throw new Error('Failed to load reviews');
    return {
      data: data.data,
      total: data.meta.total,
      page: data.meta.page,
      limit: data.meta.limit,
      stats: data.stats,
    };
  },
};