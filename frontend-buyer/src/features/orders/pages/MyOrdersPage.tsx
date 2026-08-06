import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageMeta } from "@/components/common/PageMeta";
import { OrderCard } from "@/components/order/OrderCard";
import { useOrderCounts, useOrderList } from "@/hooks/useOrders";
import { cn } from "@/lib/cn";
import type { OrderPublic } from "@/services/orderService";
import type { OrderStatus } from "@/features/orders/orders.types";

/* ──────────────────────────────────────────────────────────────────────────
 * MyOrdersPage — `/orders`
 *
 * Lists the authenticated customer's order history, paginated 10/page
 * (matches the backend's default `limit`). A few UX details worth
 * calling out:
 *
 *   • Server-state is fully driven by TanStack Query — pagination moves
 *     and tab switches are pure state changes that re-key the query and
 *     re-fetch (or hit the per-tab cache segment).
 *   • The tab bar at the top maps to the OrderStatus union — 'All'
 *     omits the status filter so the server returns orders of any
 *     status. Switching tabs resets to page 1.
 *   • Skeletons mirror the actual card layout so the layout doesn't
 *     jump on the first paint.
 *   • The empty state uses the shared `<EmptyState>` primitive and
 *     points users toward "Start shopping" / "View my cart".
 *   • The page navigation is hidden until we know there are at least 2
 *     pages — no clutter for users with a single order.
 * ───────────────────────────────────────── */

const PAGE_LIMIT = 10;

/* ── Tab definitions ──────────────────────────────────────────────────── */

interface OrdersTab {
  /** UI label shown in the tab. */
  label: string;
  /** Value passed to the API: undefined = "All", otherwise the status. */
  status: OrderStatus | undefined;
}

const TABS: OrdersTab[] = [
  { label: "All", status: undefined },
  { label: "Pending", status: "pending" },
  { label: "Processing", status: "confirmed" },
  { label: "Shipped", status: "shipping" },
  { label: "Delivered", status: "delivered" },
  { label: "Cancelled", status: "cancelled" },
];

export function MyOrdersPage() {
  const navigate = useNavigate();
  // Active tab — index into TABS. Default to "All" so the page reads
  // identically to the previous (no-tab) version on first load.
  const [activeTabIdx, setActiveTabIdxState] = useState(0);
  const [page, setPage] = useState(1);

  // Switching tabs should reset pagination to page 1 — handled inline
  // in the click handler so we don't trigger the React Compiler's
  // `react-hooks/set-state-in-effect` rule (which flags cascading
  // setState calls inside useEffect). `setActiveTabIdx` is wrapped to
  // bundle the tab change with the page reset so callers can't
  // accidentally drop the reset.
  const setActiveTabIdx = (idx: number) => {
    setActiveTabIdxState(idx);
    setPage(1);
  };

  const activeStatus = TABS[activeTabIdx].status;

  const { data, isLoading, isError, error, isFetching, isPlaceholderData } =
    useOrderList({
      page,
      limit: PAGE_LIMIT,
      status: activeStatus,
    });

  const orders: OrderPublic[] = data?.orders ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  // Single fetch on mount → every tab pill renders its count without
  // triggering 6 paginated list calls. The hook shares a 30s staleTime
  // so subsequent visits to /orders during the same session don't
  // refetch. `useCancelOrder` invalidates this key after a successful
  // cancel so the counts reflect the new state instantly.
  const countsQuery = useOrderCounts();
  const counts = countsQuery.data;

  // Map a tab's `status` (or `undefined` for "All") to its count.
  // While the counts query is loading we return `null` so the tab pill
  // doesn't render a flash-of-`0` on first paint — once the response
  // lands, every pill lights up at once.
  const countForTab = useMemo(
    () =>
      (status: OrderStatus | undefined): number | null => {
        if (!counts) return null;
        if (status === undefined) return counts.total;
        // The status values here are a subset of `OrderCounts` keys; any
        // mismatch would surface as `undefined` → 0 which is the safe
        // fallback (no count badge appears for an unknown bucket).
        return counts[status] ?? 0;
      },
    [counts],
  );

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

          <TabsRow
            tabs={TABS}
            activeIdx={activeTabIdx}
            onSelect={setActiveTabIdx}
            disabled
          />

          <div className="space-y-3 mt-6" aria-busy>
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
      (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message ??
      (error as { message?: string })?.message ??
      "We could not load your orders. Please try again.";
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

  /* ── Render: empty state (only on page 1 of "All") ──────────────────── */

  if (orders.length === 0 && page === 1 && activeStatus === undefined) {
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
                label: "Start shopping",
                onClick: () => navigate("/shop"),
                variant: "primary",
                leftIcon: <ShoppingBag size={15} aria-hidden />,
              },
              {
                label: "Go to cart",
                onClick: () => navigate("/cart"),
                variant: "secondary",
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
            <p className="mt-1 text-medium text-slate-500">
              {total === 0
                ? `No ${activeStatus ? `${activeStatus} ` : ""}orders to show`
                : `${total} ${
                    activeStatus ? `${activeStatus} ` : ""
                  }${total === 1 ? "order" : "orders"}`}
            </p>
          </div>
          {isFetching && !isLoading && (
            <span className="text-xs text-slate-400 tabular-nums">
              Refreshing…
            </span>
          )}
        </header>

        {/* Tab bar */}
        <TabsRow
          tabs={TABS}
          activeIdx={activeTabIdx}
          onSelect={setActiveTabIdx}
          countForTab={countForTab}
        />

        {/* Empty state for filtered tab with no results */}
        {orders.length === 0 && page === 1 ? (
          <EmptyState
            tone="neutral"
            icon={<Package size={28} aria-hidden />}
            title={`No ${activeStatus ?? ""} orders`}
            description={
              activeStatus === "delivered"
                ? "Once an order is delivered, it'll show up here so you can leave a review."
                : "Orders in this state will appear here."
            }
            actions={
              activeStatus
                ? [
                    {
                      label: "View all orders",
                      onClick: () => setActiveTabIdx(0),
                      variant: "secondary",
                    },
                  ]
                : undefined
            }
          />
        ) : (
          <>
            {/* List */}
            <div
              className={cn(
                "space-y-3 transition-opacity",
                isPlaceholderData && "opacity-60",
              )}
              role="list"
            >
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
                  Page <strong className="text-slate-900">{page}</strong> of{" "}
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
          </>
        )}
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * TabsRow — segmented control for status filters.
 *
 * Implemented locally instead of pulling in a heavier tabs component
 * because the only thing this needs is a labeled segmented row with
 * one active button. Kept pure so it can be reused if any other page
 * needs the same pattern.
 * ───────────────────────────────────────── */

interface TabsRowProps {
  tabs: OrdersTab[];
  activeIdx: number;
  onSelect: (idx: number) => void;
  /**
   * Per-tab count lookup. Returns the count for the given status, or
   * `null` while the counts query is still loading (so we don't show
   * a flash-of-`0` for every tab before the response lands).
   */
  countForTab?: (status: OrderStatus | undefined) => number | null;
  /** Disables interaction (used during the initial loading state). */
  disabled?: boolean;
}

function TabsRow({
  tabs,
  activeIdx,
  onSelect,
  countForTab,
  disabled,
}: TabsRowProps) {
  return (
    <div
      role="tablist"
      aria-label="Order status filter"
      className="flex flex-wrap gap-1.5 mb-6 -mx-1 px-1"
    >
      {tabs.map((tab, idx) => {
        const isActive = idx === activeIdx;
        // Always render the count badge (per design), even on
        // inactive tabs. The function returns `null` during initial
        // load so we can still skip rendering until the counts query
        // has resolved — once it has, every pill lights up at once.
        const count = countForTab ? countForTab(tab.status) : null;
        return (
          <button
            key={tab.label}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls="orders-list"
            tabIndex={isActive ? 0 : -1}
            disabled={disabled}
            onClick={() => onSelect(idx)}
            className={cn(
              // `h-10 px-4` + `text-base font-medium` gives the larger
              // text comfortable vertical/horizontal breathing room —
              // the previous `h-9 px-3.5 text-sm` cramped the labels
              // once the count badge was added.
              "inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-medium",
              "transition-colors duration-200 cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002b5b] focus-visible:ring-offset-2",
              isActive
                ? "bg-[#002b5b] text-white shadow-sm"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300",
              disabled && "opacity-50 cursor-not-allowed pointer-events-none",
            )}
          >
            <span>{tab.label}</span>
            {count !== null && count !== undefined && (
              <span
                className={cn(
                  // Bumped from text-[10px] to text-xs so the badge
                  // reads at the same scale as the surrounding label.
                  "inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 text-xs font-semibold rounded-full tabular-nums",
                  isActive
                    ? "bg-white/15 text-white"
                    : "bg-slate-100 text-slate-700",
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
