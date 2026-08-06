import { useCallback } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  reviewService,
  type CreateReviewPayload,
  type ListReviewsParams,
} from '@/services/reviewService';

/* ──────────────────────────────────────────────────────────────────────────
 * Review query keys
 *
 * Centralised so invalidation after a successful POST refreshes BOTH the
 * product detail page's reviews list AND any future "my reviews" widget
 * in one place.
 * ──────────────────────────────────────────────────────────────────────── */

export const reviewKeys = {
  all: () => ['reviews'] as const,
  /** Reviews for a specific product (paginated list + stats). */
  byProduct: (productId: string, params: ListReviewsParams) =>
    [
      ...reviewKeys.all(),
      'byProduct',
      productId,
      params.rating ?? 'all',
      params.hasComment === undefined ? 'any' : params.hasComment ? 'with' : 'without',
      params.hasMedia === undefined ? 'any' : params.hasMedia ? 'with' : 'without',
      params.page ?? 1,
      params.limit ?? 10,
    ] as const,
};

/* ──────────────────────────────────────────────────────────────────────────
 * useProductReviews — read-only list + stats for a product page.
 * ──────────────────────────────────────────────────────────────────────── */

export function useProductReviews(
  productId: string | undefined,
  params: ListReviewsParams = {},
) {
  return useQuery({
    queryKey: reviewKeys.byProduct(productId ?? '', params),
    queryFn: () => reviewService.listByProduct(productId as string, params),
    enabled: !!productId,
    // Keep previous data on screen while a filter change refetches —
    // matches the order-list pattern.
    placeholderData: keepPreviousData,
    // Stats don't change second-to-second; let React Query dedupe a
    // burst of refetches from the ratings section + the dedicated
    // reviews list.
    staleTime: 30_000,
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * useCreateReview — submit a review for a delivered order item.
 *
 * On success we invalidate the `byProduct` cache so the buyer's freshly
 * posted review appears immediately on the product page (subject to the
 * unique-constraint de-dup at the API layer).
 * ──────────────────────────────────────────────────────────────────────── */

export function useCreateReview(productId?: string) {
  const queryClient = useQueryClient();

  const invalidateProduct = useCallback(() => {
    if (!productId) return;
    queryClient.invalidateQueries({
      queryKey: reviewKeys.byProduct(productId, {}),
      // Match all filter combos for this product, not just the current
      // filter — every pill's cache should refresh.
      exact: false,
    });
  }, [queryClient, productId]);

  const formatError = (err: unknown): string => {
    const anyErr = err as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    return (
      anyErr?.response?.data?.message ??
      anyErr?.message ??
      'Could not submit your review. Please try again.'
    );
  };

  const mutation = useMutation<
    Awaited<ReturnType<typeof reviewService.create>>,
    unknown,
    CreateReviewPayload
  >({
    mutationFn: (payload) => reviewService.create(payload),
    onSuccess: () => {
      invalidateProduct();
      toast.success('Review submitted', {
        description: 'Thanks for sharing your experience.',
      });
    },
    onError: (err) => {
      toast.error('Submission failed', { description: formatError(err) });
    },
  });

  return {
    create: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
  };
}