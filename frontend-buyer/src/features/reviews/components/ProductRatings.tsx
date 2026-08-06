import { useEffect, useMemo, useState } from "react";
import { Star, ImageOff } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useProductReviews } from "@/hooks/useReviews";
import { cn } from "@/lib/cn";
import { API_ORIGIN } from "@/services/apiClient";
import type {
  ReviewPublic,
  ReviewStats,
  ReviewRating,
} from "@/services/reviewService";

/* ──────────────────────────────────────────────────────────────────────────
 * ProductRatings — reviews section shown below the product description.
 *
 * Mounted directly on the Product Detail Page, driven by a single
 * `useProductReviews` query that carries both the paginated list AND
 * the stats payload. The list is paginated client-side: the user
 * filters by star / has-comment / has-media, the query re-keys and
 * re-fetches the matching slice.
 *
 * Visual structure:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ Summary header  (avg + star visual + total reviews)      │
 *   ├──────────────────────────────────────────────────────────┤
 *   │ Filter pills  [All] [5★] [4★] [3★] [2★] [1★] [Comments]  │
 *   │                [Media]                                   │
 *   ├──────────────────────────────────────────────────────────┤
 *   │ Review cards  (avatar · name · stars · date · variant ·  │
 *   │                comment · media thumbnails)               │
 *   └──────────────────────────────────────────────────────────┘
 * ───────────────────────────────────────── */

export interface ProductRatingsProps {
  productId: string;
}

type FilterMode =
  | { kind: "all" }
  | { kind: "rating"; rating: ReviewRating }
  | { kind: "hasComment" }
  | { kind: "hasMedia" };

const PAGE_LIMIT = 5;

export function ProductRatings({ productId }: ProductRatingsProps) {
  const [filter, setFilter] = useState<FilterMode>({ kind: "all" });
  const [page, setPage] = useState(1);

  const params = {
    page,
    limit: PAGE_LIMIT,
    rating: filter.kind === "rating" ? filter.rating : undefined,
    hasComment: filter.kind === "hasComment" ? true : undefined,
    hasMedia: filter.kind === "hasMedia" ? true : undefined,
  };

  const { data, isLoading, isError, isPlaceholderData } = useProductReviews(
    productId,
    params,
  );

  // Reset to page 1 whenever the active filter changes — the user
  // shouldn't get stuck on page 4 of a 1-page result set. We key on
  // the stringified filter rather than the object identity so changing
  // `rating: 5` → `rating: 4` resets the page even when both objects
  // are referentially distinct.
  const filterKey =
    filter.kind === "rating" ? `rating-${filter.rating}` : filter.kind;
  useResetPageOnFilter(filterKey, () => setPage(1));

  const reviews = data?.data ?? [];
  const total = data?.total ?? 0;
  const stats = data?.stats;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  return (
    <section
      aria-label="Customer reviews"
      className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm mt-8"
    >
      <h2 className="text-xl font-bold text-slate-800 mb-6">
        Customer Reviews
      </h2>

      {/* Summary header */}
      <div className="mb-6">
        <SummaryHeader stats={stats} isLoading={isLoading} />
      </div>

      {/* Filter pills — pass `stats` so each pill can render its
       * bucket count next to the label (matches the MyOrdersPage
       * tab pattern). Optional chaining in the pill lookup keeps
       * the render safe while the query is loading. */}
      <FilterPills
        active={filter}
        stats={stats}
        onSelect={(next) => {
          setFilter(next);
          setPage(1);
        }}
      />

      {/* Review list */}
      <div className="mt-6">
        {isLoading ? (
          <ReviewListSkeleton />
        ) : isError ? (
          <div className="rounded-xl border border-danger-100 bg-danger-50 px-4 py-6 text-center text-sm text-danger-700">
            We couldn&apos;t load reviews for this product. Please refresh.
          </div>
        ) : reviews.length === 0 ? (
          <EmptyState
            tone="neutral"
            icon={<ImageOff size={26} aria-hidden />}
            title={
              filter.kind === "all"
                ? "No reviews yet"
                : "No reviews match this filter"
            }
            description={
              filter.kind === "all"
                ? "Be the first to share what you think about this product."
                : "Try a different filter to see more reviews."
            }
          />
        ) : (
          <>
            <ul
              className={cn(
                "space-y-4 transition-opacity",
                isPlaceholderData && "opacity-60",
              )}
            >
              {reviews.map((review) => (
                <li key={review.id}>
                  <ReviewCard review={review} />
                </li>
              ))}
            </ul>

            {totalPages > 1 && (
              <Pagination
                page={page}
                totalPages={totalPages}
                onChange={setPage}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * useResetPageOnFilter — small helper that resets the page to 1
 * whenever the active filter key changes. Extracted so we don't
 * duplicate the useEffect pattern in callers.
 * ───────────────────────────────────────── */

function useResetPageOnFilter(filterKey: string, reset: () => void) {
  useEffect(() => {
    reset();
  }, [filterKey, reset]);
}

/* ──────────────────────────────────────────────────────────────────────────
 * SummaryHeader — average rating + star visual + total count.
 * ───────────────────────────────────────── */

function SummaryHeader({
  stats,
  isLoading,
}: {
  stats: ReviewStats | undefined;
  isLoading: boolean;
}) {
  if (isLoading || !stats) {
    return (
      <div className="flex items-center gap-6">
        <Skeleton className="h-16 w-24" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    );
  }

  const { averageRating, totalReviews } = stats;

  return (
    <div className="flex flex-col sm:flex-row items-start gap-6 sm:gap-10">
      {/*
       * Left column: big number stacked ABOVE the star visual.
       * Previously these sat on a single row with the number on the
       * left and stars on the right, which made the stars feel
       * disconnected from the rating. Stacking them vertically
       * (number → /5 → stars) reads as one cohesive "score" block,
       * which is the standard pattern on e-commerce review sections.
       */}
      <div className="flex flex-col items-start gap-1.5 shrink-0">
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-bold text-slate-900 tabular-nums leading-none">
            {averageRating.toFixed(1)}
          </span>
          <span className="text-lg text-slate-500 font-medium">/ 5</span>
        </div>
        {/* Star visual sits directly below the big number. */}
        <StarsRow value={averageRating} size={20} />
      </div>

      {/* Right column: total-review text + breakdown bars */}
      <div className="flex-1 min-w-0">
        <p className="mt-2 text-sm text-slate-600">
          <strong className="text-slate-900">{totalReviews}</strong>{" "}
          {totalReviews === 1 ? "review" : "reviews"} from verified buyers
        </p>

        {/* Star breakdown bars — handy at-a-glance signal of where most
         * reviewers land. Width is proportional to the bucket share
         * among all reviews. */}
        <div className="mt-3 space-y-1.5 max-w-md">
          {[5, 4, 3, 2, 1].map((n) => {
            const count =
              stats.starCounts[String(n) as "1" | "2" | "3" | "4" | "5"];
            const pct =
              totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
            return (
              /*
               * Bar row bumped from `text-xs` → `text-base` so the
               * left star label and the right count read at the same
               * scale. `gap-3.5` adds a little breathing room since
               * the row is now slightly taller.
               */
              <div key={n} className="flex items-center gap-3.5 text-base">
                {/* Star label bumped from text-slate-600 → text-slate-700
                 * and font-medium so it visually balances the
                 * right-side count. `w-8` (vs the previous w-6) gives
                 * the larger digit room without clipping. */}
                <span className="w-8 font-medium text-slate-700 tabular-nums">
                  {n}★
                </span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {/* Per-bucket count. Bumped from text-xs / text-slate-500
                 * to text-base / font-medium / text-slate-700 so the
                 * number reads at the same scale as the row's other
                 * content (especially on dense review pages). */}
                <span className="w-10 text-right text-base font-medium text-slate-700 tabular-nums">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * FilterPills — segmented row of filter chips.
 * ───────────────────────────────────────── */

function FilterPills({
  active,
  onSelect,
  stats,
}: {
  active: FilterMode;
  onSelect: (next: FilterMode) => void;
  /**
   * Aggregate stats from `useProductReviews`. Each pill renders its
   * bucket count from this object using the mapping below. Safe to
   * pass `undefined` — the pill falls back to 0 while the query is
   * still loading.
   */
  stats?: ReviewStats;
}) {
  /*
   * Each pill maps to a single bucket in the stats payload:
   *   • All        → stats.totalReviews
   *   • N Star     → stats.starCounts[String(N)]
   *   • With Comments → stats.withComments
   *   • With Media    → stats.withMedia
   *
   * The lookup uses `?.` / `?? 0` so an undefined `stats` (initial
   * load) doesn't crash — the badge simply renders "0" until the
   * query resolves.
   */
  const pills: Array<{ label: string; value: FilterMode; count: number }> = [
    { label: "All", value: { kind: "all" }, count: stats?.totalReviews ?? 0 },
    {
      label: "5 Star",
      value: { kind: "rating", rating: 5 },
      count: stats?.starCounts["5"] ?? 0,
    },
    {
      label: "4 Star",
      value: { kind: "rating", rating: 4 },
      count: stats?.starCounts["4"] ?? 0,
    },
    {
      label: "3 Star",
      value: { kind: "rating", rating: 3 },
      count: stats?.starCounts["3"] ?? 0,
    },
    {
      label: "2 Star",
      value: { kind: "rating", rating: 2 },
      count: stats?.starCounts["2"] ?? 0,
    },
    {
      label: "1 Star",
      value: { kind: "rating", rating: 1 },
      count: stats?.starCounts["1"] ?? 0,
    },
    {
      label: "With Comments",
      value: { kind: "hasComment" },
      count: stats?.withComments ?? 0,
    },
    {
      label: "With Media",
      value: { kind: "hasMedia" },
      count: stats?.withMedia ?? 0,
    },
  ];

  return (
    <div
      role="tablist"
      aria-label="Review filters"
      className="flex flex-wrap gap-2"
    >
      {pills.map((pill) => {
        const isActive = sameFilter(pill.value, active);
        return (
          <button
            key={pill.label}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(pill.value)}
            className={cn(
              // Matches the MyOrdersPage tab pattern: h-10 px-4
              // + text-base font-medium so the larger text +
              // count badge sits comfortably.
              "inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-medium",
              "transition-colors duration-200 cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002b5b] focus-visible:ring-offset-2",
              isActive
                ? "bg-[#002b5b] text-white shadow-sm"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300",
            )}
          >
            <span>{pill.label}</span>
            {/* Count badge — same shape as the MyOrdersPage tab
             * badge. White/translucent on the active pill, muted
             * slate on inactive. Renders the bucket size so the
             * user can gauge the filter before clicking. */}
            <span
              aria-label={`${pill.count} reviews`}
              className={cn(
                "inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 text-xs font-semibold rounded-full tabular-nums",
                isActive
                  ? "bg-white/15 text-white"
                  : "bg-slate-100 text-slate-700",
              )}
            >
              {pill.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function sameFilter(a: FilterMode, b: FilterMode): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "rating" && b.kind === "rating") return a.rating === b.rating;
  return true;
}

/* ──────────────────────────────────────────────────────────────────────────
 * ReviewCard — single review entry.
 * ───────────────────────────────────────── */

function ReviewCard({ review }: { review: ReviewPublic }) {
  const { author, rating, comment, mediaUrls, variant, createdAt } = review;

  const initial = (author.name || "?").trim().charAt(0).toUpperCase() || "?";
  const dateStr = formatReviewDate(createdAt);

  return (
    /*
     * Outer flex row: avatar on the left (fixed-width, shrink-0) and a
     * flexible column on the right that holds the header, comment, and
     * media. Wrapping every child of the column in the same wrapper
     * guarantees the comment + media align with the LEFT EDGE of the
     * user's name — instead of full-width under the avatar as before.
     *
     * Avatar gets `shrink-0` so a tall comment can't squeeze it; the
     * column wrapper gets `min-w-0` so long unbroken text (URLs, etc.)
     * inside it can wrap instead of pushing the layout out.
     */
    <article className="flex gap-4 border border-slate-200 rounded-xl p-4 sm:p-5">
      <div className="shrink-0">
        <Avatar name={author.name} initial={initial} url={author.avatarUrl} />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header: name + stars + date. `mb-2` sets the vertical
         * rhythm between the header line and the comment below. */}
        <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
          {/* Reviewer name bumped from text-sm font-semibold →
           * text-base font-semibold so it reads as a prominent
           * identifier alongside the (also bumped) comment. */}
          <p className="text-base font-semibold text-slate-900 truncate">
            {author.name || "Anonymous"}
          </p>
          <StarsRow value={rating} size={16} />
          <time
            dateTime={createdAt}
            className="text-xs text-slate-500 tabular-nums ml-auto"
          >
            {dateStr}
          </time>
        </header>

        {/* Variant descriptor — small, muted, sits between the header
         * and the comment so the comment is the visual focus. */}
        {variant.attributes.length > 0 && (
          <p className="text-xs text-slate-500 mb-2">
            {variant.attributes.map((a) => `${a.name}: ${a.value}`).join(", ")}
          </p>
        )}

        {/* Comment — bumped from text-sm text-slate-700 →
         * text-base text-slate-800 so the user's actual feedback
         * reads as the focal point of the card. `leading-relaxed`
         * keeps long paragraphs scannable. `whitespace-pre-wrap`
         * preserves the user's paragraph breaks from the database.
         * `mb-3` gives the media grid breathing room when present. */}
        {comment && (
          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap mb-3 last:mb-0">
            {comment}
          </p>
        )}

        {/* Media thumbnails */}
        {mediaUrls.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {mediaUrls.map((url, i) => (
              <li key={`${url}-${i}`}>
                <MediaThumb url={url} alt={`Review attachment ${i + 1}`} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * StarsRow — read-only visual star row.
 *
 * Filled stars use amber-400 (matches the picker in the review modal),
 * unfilled stars use slate-300. `value` is a number — typically an
 * integer (1-5) for a single review, but the summary header passes
 * a fractional `averageRating` so we round up at the half-star mark
 * by rendering a `filled + half` combination.
 * ───────────────────────────────────────── */

function StarsRow({ value, size = 14 }: { value: number; size?: number }) {
  // Round to nearest half for display; fractional averages look cleaner
  // when shown with a half-star than with 5 tiny sub-pixel fills.
  const rounded = Math.round(value * 2) / 2;
  return (
    <div
      className="inline-flex items-center gap-0.5"
      aria-label={`${value} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= rounded;
        const half = !filled && n - 0.5 === rounded;
        return (
          <span
            key={n}
            className="relative inline-block"
            style={{ width: size, height: size }}
            aria-hidden
          >
            <Star
              size={size}
              className="absolute inset-0 text-slate-300"
              strokeWidth={1.5}
            />
            {(filled || half) && (
              <Star
                size={size}
                className="absolute inset-0 fill-amber-400 text-amber-400"
                strokeWidth={1.5}
                style={
                  half
                    ? // Half-star: clip the fill to the left half so the
                      // right half stays muted.
                      { clipPath: "inset(0 50% 0 0)" }
                    : undefined
                }
              />
            )}
          </span>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Avatar — circular avatar with initial-letter fallback.
 * ───────────────────────────────────────── */

function Avatar({
  name,
  initial,
  url,
}: {
  name: string;
  initial: string;
  url: string | null;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt={name || "Reviewer"}
        className="h-10 w-10 rounded-full object-cover shrink-0 bg-slate-100"
        loading="lazy"
      />
    );
  }
  return (
    <div
      aria-hidden
      className="h-10 w-10 rounded-full bg-slate-200 text-slate-700 font-semibold flex items-center justify-center text-sm shrink-0"
    >
      {initial}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * MediaThumb — small click-to-enlarge attachment thumbnail.
 * ───────────────────────────────────────── */

function MediaThumb({ url, alt }: { url: string; alt: string }) {
  // Same URL-qualifying logic as `productService` — relative `/uploads/…`
  // paths become absolute against the API origin. The backend never
  // returns absolute URLs from the upload service (see
  // `productService.qualifyUrl`), so the relative case is the common one.
  const absolute = qualifyMediaUrl(url);
  return (
    <a
      href={absolute}
      target="_blank"
      rel="noopener noreferrer"
      className="block h-20 w-20 rounded-lg overflow-hidden border border-slate-200 hover:border-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002b5b] focus-visible:ring-offset-2"
    >
      <img
        src={absolute}
        alt={alt}
        loading="lazy"
        className="h-full w-full object-cover"
      />
    </a>
  );
}

function qualifyMediaUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_ORIGIN}${url}`;
}

/* ──────────────────────────────────────────────────────────────────────────
 * ReviewListSkeleton — placeholder rows matching the ReviewCard layout.
 * ───────────────────────────────────────── */

function ReviewListSkeleton() {
  return (
    <ul className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <li
          key={i}
          className="border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3"
        >
          <div className="flex items-start gap-3">
            <Skeleton variant="circular" className="h-10 w-10" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </li>
      ))}
    </ul>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Pagination — Prev / Next for the review list.
 * ───────────────────────────────────────── */

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  /*
   * Build the list of page tokens to render.
   *
   *   • Always include 1 and `totalPages` so the user can jump to
   *     either end in one click.
   *   • Always include `page` and its immediate neighbours (±1) so
   *     the current position is obvious.
   *   • Insert an `ellipsis` token (`…`) when there's a gap > 1
   *     between adjacent rendered numbers — prevents a long scroll
   *     of irrelevant page buttons when `totalPages` is large.
   *
   * The result is e.g. `[1, …, 4, 5, 6, …, 12]` for page 5 of 12.
   */
  const tokens = useMemo(() => {
    const items: Array<{ kind: "page"; n: number } | { kind: "ellipsis" }> = [];
    const push = (n: number) => {
      if (items[items.length - 1]?.kind === "page") {
        const last = items[items.length - 1] as { kind: "page"; n: number };
        if (last.n === n) return; // dedupe consecutive duplicates
      }
      items.push({ kind: "page", n });
    };
    const range = new Set<number>([1, totalPages, page - 1, page, page + 1]);
    for (const n of range) {
      if (n >= 1 && n <= totalPages) push(n);
    }
    // Walk through items, inserting ellipsis where there's a gap.
    const result: typeof items = [];
    for (let i = 0; i < items.length; i++) {
      const cur = items[i] as { kind: "page"; n: number };
      const prev = items[i - 1] as { kind: "page"; n: number } | undefined;
      if (
        prev &&
        cur.kind === "page" &&
        prev.kind === "page" &&
        cur.n - prev.n > 1
      ) {
        result.push({ kind: "ellipsis" });
      }
      result.push(cur);
    }
    return result;
  }, [page, totalPages]);

  return (
    <nav
      aria-label="Reviews pagination"
      className="mt-6 flex items-center justify-center gap-1.5 border-t border-slate-100 pt-4"
    >
      {/* Prev — bumped to text-base for visual parity with the new
       * review typography. `disabled` blocks both the click handler
       * and the hover style. */}
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(Math.max(1, page - 1))}
        className={cn(
          "inline-flex items-center justify-center min-w-[2.25rem] h-9 px-2.5 rounded-md text-base font-medium cursor-pointer",
          "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-700",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002b5b] focus-visible:ring-offset-2",
        )}
      >
        ← Prev
      </button>

      {/* Page numbers + ellipsis. Active page uses the brand fill;
       * ellipsis is a non-interactive span so it doesn't show up as
       * a focusable tab stop or get an aria role. */}
      {tokens.map((tok, i) =>
        tok.kind === "ellipsis" ? (
          <span
            key={`ellipsis-${i}`}
            aria-hidden
            className="inline-flex items-center justify-center min-w-[2.25rem] h-9 text-base text-slate-400 select-none"
          >
            …
          </span>
        ) : (
          <button
            key={`page-${tok.n}`}
            type="button"
            aria-current={tok.n === page ? "page" : undefined}
            onClick={() => onChange(tok.n)}
            className={cn(
              "inline-flex items-center justify-center min-w-[2.25rem] h-9 px-2 rounded-md text-base font-medium tabular-nums cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002b5b] focus-visible:ring-offset-2",
              tok.n === page
                ? "bg-[#002b5b] text-white shadow-sm"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            {tok.n}
          </button>
        ),
      )}

      {/* Next */}
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        className={cn(
          "inline-flex items-center justify-center min-w-[2.25rem] h-9 px-2.5 rounded-md text-base font-medium cursor-pointer",
          "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-700",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002b5b] focus-visible:ring-offset-2",
        )}
      >
        Next →
      </button>
    </nav>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Date helper — locale-aware short date + time.
 * ───────────────────────────────────────── */

const REVIEW_DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatReviewDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return REVIEW_DATE_FMT.format(d);
}

// Re-export the meta component if any consumer needs a bare summary.
// Currently unused outside this file; kept as a convenience in case
// a future component (e.g. a "snippet" preview) wants to embed just
// the stars + average.
export { StarsRow };
export type { FilterMode };
