import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageMeta } from '@/components/common/PageMeta';
import { OrderCard } from '@/components/order/OrderCard';
import { useOrderList } from '@/hooks/useOrders';

/* ──────────────────────────────────────────────────────────────────────────
 * MyOrdersPage — `/orders`
 *
 * Lists the authenticated customer's order history, paginated 10/page
 * (matches the backend's default `limit`). A few UX details worth
 * calling out:
 *
 *   • Server-state is fully driven by TanStack Query — pagination moves
 *     are pure state changes that re-key the query and re-fetch.
 *   • Skeletons mirror the actual card layout so the layout doesn't
 *     jump on the first paint.
 *   • The empty state uses the shared `<EmptyState>` primitive and
 *     points users toward "Start shopping" / "View my cart" — matching
 *     the design system used everywhere else.
 *   • The page navigation is hidden until we know there are at least 2
 *     pages — no clutter for users with a single order.
 * ───────────────────────────────────────── */

const PAGE_LIMIT = 10;

export function MyOrdersPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, isFetching } = useOrderList({
    page,
    limit: PAGE_LIMIT,
  });

  const orders = data?.orders ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  /* ── Render: loading skeletons ──────────────────────────────────────── */

  if (isLoading) {
    return (
      <>
        <PageMeta title="My orders" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <header className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              My Orders
            </h1>
            <p className="mt-1 text-sm text-slate-500">Loading your orders…</p>
          </header>

          <div className="space-y-3" aria-busy>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-100 bg-white shadow-sm p-5"
              >
                <div className="flex justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <div className="space-y-2 text-right">
                    <Skeleton className="h-3 w-12 ml-auto" />
                    <Skeleton className="h-4 w-24 ml-auto" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  /* ── Render: error state ────────────────────────────────────────────── */

  if (isError) {
    const message =
      (error as { response?: { data?: { message?: string } } })?.response
        ?.data?.message ??
      (error as { message?: string })?.message ??
      'We could not load your orders. Please try again.';
    return (
      <>
        <PageMeta title="My orders" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <header className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              My Orders
            </h1>
          </header>
          <div className="rounded-xl border border-danger-100 bg-danger-50 p-6 text-center">
            <p className="text-sm font-medium text-danger-700">{message}</p>
            <Button
              variant="primary"
              size="md"
              className="mt-4"
              onClick={() => setPage(1)}
            >
              Try again
            </Button>
          </div>
        </div>
      </>
    );
  }

  /* ── Render: empty state ───────────────────────────────────────────── */

  if (orders.length === 0 && page === 1) {
    return (
      <>
        <PageMeta
          title="My orders"
          description="Track, view, and manage your Triverce purchases."
        />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <EmptyState
            tone="brand"
            icon={<Package size={28} aria-hidden />}
            title="No orders yet"
            description="Once you place an order, it'll show up here so you can track its status, view items, and reorder your favourites."
            actions={[
              {
                label: 'Start shopping',
                onClick: () => navigate('/shop'),
                variant: 'primary',
                leftIcon: <ShoppingBag size={15} aria-hidden />,
              },
              {
                label: 'Go to cart',
                onClick: () => navigate('/cart'),
                variant: 'secondary',
              },
            ]}
          />
        </div>
      </>
    );
  }

  /* ── Render: list + pagination ──────────────────────────────────────── */

  return (
    <>
      <PageMeta
        title="My orders"
        description="Track, view, and manage your Triverce purchases."
      />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <header className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              My Orders
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {total === 0
                ? 'No orders yet'
                : `${total} ${total === 1 ? 'order' : 'orders'} in total`}
            </p>
          </div>
          {isFetching && !isLoading && (
            <span className="text-xs text-slate-400 tabular-nums">
              Refreshing…
            </span>
          )}
        </header>

        {/* List */}
        <div className="space-y-3" role="list">
          {orders.map((order) => (
            <div role="listitem" key={order.id}>
              <OrderCard order={order} />
            </div>
          ))}
        </div>

        {/* Pagination — only render when there's more than one page */}
        {totalPages > 1 && (
          <nav
            className="mt-8 flex items-center justify-between gap-3 border-t border-slate-200 pt-6"
            aria-label="Orders pagination"
          >
            <Button
              variant="secondary"
              size="md"
              disabled={!hasPrev}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              leftIcon={<ChevronLeft size={16} aria-hidden />}
            >
              Previous
            </Button>
            <span className="text-sm text-slate-600 tabular-nums">
              Page <strong className="text-slate-900">{page}</strong> of{' '}
              <strong className="text-slate-900">{totalPages}</strong>
            </span>
            <Button
              variant="secondary"
              size="md"
              disabled={!hasNext}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              rightIcon={<ChevronRight size={16} aria-hidden />}
            >
              Next
            </Button>
          </nav>
        )}
      </div>
    </>
  );
}
