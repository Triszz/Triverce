import { useMemo, useState } from 'react';
import { Star, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useCreateReview } from '@/hooks/useReviews';
import type { OrderPublic, OrderItemPublic } from '@/services/orderService';
import type { ReviewRating } from '@/services/reviewService';
import { cn } from '@/lib/cn';

/* ──────────────────────────────────────────────────────────────────────────
 * WriteReviewModal — per-order "Write a Review" form.
 *
 * Per the business rule, only `delivered` orders can be reviewed. The
 * `OrderCard` already gates the "Write a Review" CTA behind
 * `order.status === 'delivered'`, but we double-check here as a defense
 * in case a stale order is rendered after its status changes.
 *
 * The modal lists every order item so the buyer can submit a review
 * for each line. Each item has its own star rating + comment. If the
 * buyer wants to skip an item, they leave the stars untouched and the
 * row is treated as "no submission" when they hit Submit.
 *
 * Per the API contract, each `POST /reviews` call needs the specific
 * `orderItemId`. We submit one row at a time and surface partial
 * success — failures don't block the rest of the form.
 * ───────────────────────────────────────── */

export interface WriteReviewModalProps {
  open: boolean;
  onClose: () => void;
  order: OrderPublic;
}

interface PerItemState {
  rating: ReviewRating | null;
  comment: string;
  /** True once a successful POST lands. UI flips to read-only. */
  submitted: boolean;
  /** True while POST is in flight, so the Submit button can disable. */
  submitting: boolean;
  /** Most recent error for this row, if any. */
  error: string | null;
}

function emptyState(): PerItemState {
  return {
    rating: null,
    comment: '',
    submitted: false,
    submitting: false,
    error: null,
  };
}

export function WriteReviewModal({ open, onClose, order }: WriteReviewModalProps) {
  const { create } = useCreateReview();

  // Per-row state. Re-derived on `order.id` change so re-opening the
  // modal with a different order starts clean.
  const [states, setStates] = useState<Record<string, PerItemState>>(() =>
    Object.fromEntries(order.items.map((it) => [it.id, emptyState()])),
  );

  const eligible = useMemo(
    // We never render this modal for non-delivered orders, but keep the
    // guard in case the parent passes a stale order. If somehow the
    // modal opens for a non-delivered order, the body is replaced with
    // an explanatory message instead of the form.
    () => order.status === 'delivered',
    [order.status],
  );

  if (!eligible) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Write a Review"
        size="md"
      >
        <p className="text-sm text-slate-600">
          Reviews are only available after your order has been delivered.
          This order is currently <strong>{order.status}</strong>.
        </p>
      </Modal>
    );
  }

  const updateState = (itemId: string, patch: Partial<PerItemState>) => {
    setStates((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? emptyState()), ...patch },
    }));
  };

  const submitOne = async (item: OrderItemPublic) => {
    const state = states[item.id] ?? emptyState();
    if (!state.rating) {
      updateState(item.id, { error: 'Please pick a star rating.' });
      return;
    }
    updateState(item.id, { submitting: true, error: null });
    try {
      await create({
        orderItemId: item.id,
        rating: state.rating,
        comment: state.comment.trim() || undefined,
      });
      updateState(item.id, { submitted: true, submitting: false, error: null });
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ??
        (err as { message?: string })?.message ??
        'Could not submit your review.';
      updateState(item.id, { submitting: false, error: message });
    }
  };

  const allSubmitted = order.items.every(
    (it) => states[it.id]?.submitted === true,
  );
  const someUnsubmitted = order.items.some(
    (it) => states[it.id]?.submitted !== true,
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Review items from order #${order.id.slice(0, 8).toUpperCase()}`}
      meta="Share your experience to help other buyers."
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {allSubmitted
              ? 'All items reviewed — thanks!'
              : 'Each review is submitted independently.'}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            leftIcon={<X size={14} aria-hidden />}
          >
            {allSubmitted ? 'Done' : 'Close'}
          </Button>
        </div>
      }
    >
      <div className="space-y-6 pt-2">
        {order.items.map((item) => {
          const state = states[item.id] ?? emptyState();
          return (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200 p-4 space-y-3"
            >
              {/* Item header */}
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {item.productName}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Variant SKU: <span className="font-mono">{item.variantSku}</span>
                  {' · '}
                  Qty {item.quantity}
                </p>
              </div>

              {/* Star rating row */}
              <div>
                <p className="text-xs font-medium text-slate-700 mb-1.5">
                  Your rating <span className="text-danger-600">*</span>
                </p>
                <StarPicker
                  value={state.rating}
                  disabled={state.submitted}
                  onChange={(v) =>
                    updateState(item.id, { rating: v, error: null })
                  }
                />
              </div>

              {/* Comment textarea */}
              <div>
                <label
                  htmlFor={`review-comment-${item.id}`}
                  className="text-xs font-medium text-slate-700 mb-1.5 block"
                >
                  Comment <span className="text-slate-400">(optional)</span>
                </label>
                <textarea
                  id={`review-comment-${item.id}`}
                  rows={3}
                  maxLength={2000}
                  value={state.comment}
                  disabled={state.submitted}
                  onChange={(e) =>
                    updateState(item.id, { comment: e.target.value })
                  }
                  placeholder="What did you like or dislike?"
                  className={cn(
                    'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800',
                    'placeholder:text-slate-400 focus:outline-none focus:border-[#002b5b] focus:ring-2 focus:ring-[#002b5b]/20',
                    'disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed',
                    'transition-colors',
                  )}
                />
                <p className="mt-1 text-[10px] text-slate-400 text-right tabular-nums">
                  {state.comment.length}/2000
                </p>
              </div>

              {/* Error display */}
              {state.error && (
                <p className="text-xs text-danger-600">{state.error}</p>
              )}

              {/* Per-item submit / status */}
              {state.submitted ? (
                <p className="text-xs text-success-700 inline-flex items-center gap-1">
                  <Star size={12} aria-hidden className="fill-current" />
                  Review submitted. Thanks!
                </p>
              ) : (
                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={state.submitting}
                    disabled={!state.rating || state.submitting}
                    onClick={() => submitOne(item)}
                  >
                    Submit review
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {allSubmitted && (
          <div className="rounded-xl bg-success-50 border border-success-100 px-4 py-3 text-sm text-success-800">
            All {order.items.length} item
            {order.items.length === 1 ? '' : 's'} reviewed.
          </div>
        )}

        {someUnsubmitted && !allSubmitted && (
          <p className="text-xs text-slate-500 text-center">
            Submit a review for each item above. You can come back any time
            to add missing reviews.
          </p>
        )}
      </div>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * StarPicker — controlled 1–5 star control.
 *
 * Renders 5 buttons; clicking star N sets the value to N. Hovering
 * previews the new value (and the corresponding stars light up). After
 * blur, the value sticks.
 * ───────────────────────────────────────── */

function StarPicker({
  value,
  onChange,
  disabled,
}: {
  value: ReviewRating | null;
  onChange: (v: ReviewRating) => void;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState<ReviewRating | null>(null);
  const active = hovered ?? value ?? 0;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1',
        disabled && 'opacity-60 pointer-events-none',
      )}
      role="radiogroup"
      aria-label="Star rating"
      onMouseLeave={() => setHovered(null)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= active;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
            disabled={disabled}
            onMouseEnter={() => setHovered(n as ReviewRating)}
            onFocus={() => setHovered(n as ReviewRating)}
            onBlur={() => setHovered(null)}
            onClick={() => onChange(n as ReviewRating)}
            className={cn(
              'p-1 rounded transition-transform',
              'hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#002b5b] focus-visible:ring-offset-1',
              'cursor-pointer',
            )}
          >
            <Star
              size={24}
              aria-hidden
              className={cn(
                'transition-colors',
                filled
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-slate-300',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}