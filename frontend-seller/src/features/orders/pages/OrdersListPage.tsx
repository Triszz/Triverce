import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  Package,
  ShoppingBag,
} from 'lucide-react';
import { formatVnd } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useOrders } from '../hooks/useOrders';
import {
  OrderStatusBadge,
  orderStatusLabel,
} from '../components/OrderStatusBadge';
import type { Order, OrderStatus } from '@/types/order';

/* ──────────────────────────────────────────────────────────────────────────
 * Filter chip definitions
 *
 * The backend's `GET /api/orders` does not accept a status filter (see
 * `orderService.getSellerOrders`), so we filter client-side against the
 * loaded page. Counts shown next to each chip are computed from the
 * current page only — switching pages refetches and recalculates. The
 * "All" chip shows the total returned for the current page.
 * ────────────────────────────────────────────────────────────────────────── */

type StatusFilter = OrderStatus | 'all';

interface FilterChip {
  value: StatusFilter;
  label: string;
}

const FILTER_CHIPS: FilterChip[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: orderStatusLabel('pending') },
  { value: 'confirmed', label: orderStatusLabel('confirmed') },
  { value: 'shipping', label: orderStatusLabel('shipping') },
  { value: 'delivered', label: orderStatusLabel('delivered') },
  { value: 'cancelled', label: orderStatusLabel('cancelled') },
  { value: 'failed', label: orderStatusLabel('failed') },
];

/**
 * Render the first 8 chars of an order UUID, prefixed with a `#` so it
 * reads like an order reference (e.g. `#d8d26b8c`). UUIDs are too long
 * to display in a row; the full id is still in the row's `data-id` for
 * debugging.
 */
function shortOrderId(id: string): string {
  return `#${id.slice(0, 8)}`;
}

/**
 * Format an ISO date string into a concise display ("12 Jun 2026, 14:30").
 * Falls back to the raw string if `Date` can't parse it — defensive,
 * never throw in a render path.
 */
function formatOrderDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function OrdersListPage() {
  const navigate = useNavigate();

  // Pagination — start on page 1, drive the React Query cache directly.
  const [page, setPage] = useState(1);
  const limit = 10;

  // Status filter — client-side only. We re-use the same query cache as
  // the underlying useOrders so the page feels instant when toggling chips.
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');

  const { data, isLoading, isError, error, refetch, isFetching } = useOrders({
    page,
    limit,
  });

  const orders = data?.orders ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Counts per status, derived from the currently-loaded page. We don't
  // re-fetch per chip — the user can tell from "X on this page" that the
  // filter is working, and the totals row at the bottom gives a more
  // honest "X of Y total" picture.
  const statusCounts = useMemo(() => {
    const counts = new Map<OrderStatus, number>();
    for (const o of orders) {
      counts.set(o.status, (counts.get(o.status) ?? 0) + 1);
    }
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (activeFilter === 'all') return orders;
    return orders.filter((o) => o.status === activeFilter);
  }, [orders, activeFilter]);

  /* ── Loading & error states ──────────────────────────────────────────── */

  if (isLoading) return <OrdersListSkeleton />;

  if (isError || !data) {
    return (
      <ErrorState
        message={(error as Error)?.message ?? 'Failed to load orders'}
        onRetry={() => void refetch()}
        onBack={() => navigate('/')}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-2 cursor-pointer"
        >
          <ArrowLeft size={14} aria-hidden /> Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
        <p className="mt-1 text-sm text-slate-500">
          Track and fulfill customer orders. {total.toLocaleString()} total
          order{total === 1 ? '' : 's'}.
        </p>
      </div>

      {/* Filter chips */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mr-2 shrink-0">
            Status
          </span>
          {FILTER_CHIPS.map((chip) => {
            const isActive = chip.value === activeFilter;
            const count =
              chip.value === 'all'
                ? orders.length
                : (statusCounts.get(chip.value as OrderStatus) ?? 0);
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => setActiveFilter(chip.value)}
                aria-pressed={isActive}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors cursor-pointer',
                  isActive
                    ? 'bg-[#002b5b] text-white border-[#002b5b]'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
                )}
              >
                {chip.label}
                <span
                  className={cn(
                    'inline-flex items-center justify-center min-w-[1.25rem] px-1 rounded-full text-[10px] font-semibold',
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
          {isFetching && (
            <span className="ml-auto text-xs text-slate-400 shrink-0">
              Refreshing…
            </span>
          )}
        </div>

        {/* Table or empty state */}
        {filteredOrders.length === 0 ? (
          <EmptyOrders activeFilter={activeFilter} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-3">Order</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3 text-right">Items</th>
                  <th className="px-6 py-3 text-right">Total</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    onOpen={() => navigate(`/orders/${order.id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        {total > 0 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl">
            <p className="text-xs text-slate-500">
              Showing page {page} of {totalPages} ·{' '}
              {total.toLocaleString()} order{total === 1 ? '' : 's'} total
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
                className="p-1.5 rounded-md text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-600 cursor-pointer transition-colors"
              >
                <ChevronLeft size={16} aria-hidden />
              </button>
              <span className="px-2 text-xs font-medium text-slate-700 tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="Next page"
                className="p-1.5 rounded-md text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-600 cursor-pointer transition-colors"
              >
                <ChevronRight size={16} aria-hidden />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Row component — extracted so the parent's render stays readable.
 * ────────────────────────────────────────────────────────────────────────── */

function OrderRow({
  order,
  onOpen,
}: {
  order: Order;
  onOpen: () => void;
}) {
  const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <tr
      data-id={order.id}
      className="hover:bg-slate-50 transition-colors cursor-pointer"
      onClick={onOpen}
    >
      <td className="px-6 py-3">
        <span className="font-mono text-xs font-medium text-slate-900">
          {shortOrderId(order.id)}
        </span>
      </td>
      <td className="px-6 py-3 text-slate-600 whitespace-nowrap">
        {formatOrderDate(order.createdAt)}
      </td>
      <td className="px-6 py-3">
        <span className="font-medium text-slate-900">
          {order.shippingName}
        </span>
        <span className="block text-xs text-slate-500 mt-0.5">
          {order.shippingPhone}
        </span>
      </td>
      <td className="px-6 py-3 text-right tabular-nums text-slate-700">
        {itemCount}
      </td>
      <td className="px-6 py-3 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">
        {formatVnd(order.totalAmount)}
      </td>
      <td className="px-6 py-3">
        <OrderStatusBadge status={order.status} size="sm" />
      </td>
      <td className="px-6 py-3 text-right">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          aria-label={`View order ${shortOrderId(order.id)}`}
          className="inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition-colors cursor-pointer"
        >
          <Eye size={16} aria-hidden />
        </button>
      </td>
    </tr>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Skeletons / empty / error states
 * ────────────────────────────────────────────────────────────────────────── */

function OrdersListSkeleton() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-4 w-24 rounded bg-slate-100" />
        <div className="h-7 w-48 rounded bg-slate-200" />
        <div className="h-4 w-72 rounded bg-slate-100" />
      </div>
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="h-12 border-b border-slate-200 bg-slate-50" />
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 px-6 flex items-center gap-4">
              <div className="h-3 w-16 rounded bg-slate-100" />
              <div className="h-3 w-32 rounded bg-slate-100" />
              <div className="h-3 flex-1 rounded bg-slate-100" />
              <div className="h-3 w-16 rounded bg-slate-100" />
              <div className="h-3 w-24 rounded bg-slate-100" />
              <div className="h-5 w-20 rounded-full bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyOrders({ activeFilter }: { activeFilter: StatusFilter }) {
  const isFiltered = activeFilter !== 'all';
  return (
    <div className="px-6 py-16 text-center">
      <span className="inline-flex w-12 h-12 rounded-full bg-slate-100 items-center justify-center mb-3">
        <ShoppingBag size={20} className="text-slate-500" aria-hidden />
      </span>
      <h3 className="text-sm font-semibold text-slate-900">
        {isFiltered ? 'No orders match this filter' : 'No orders yet'}
      </h3>
      <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
        {isFiltered
          ? 'Try clearing the filter to see all orders.'
          : 'When customers place orders, they will appear here.'}
      </p>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
  onBack,
}: {
  message: string;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-6 py-12 text-center">
        <Package size={28} className="mx-auto text-slate-300 mb-2" aria-hidden />
        <p className="text-base font-semibold text-red-600">
          Failed to load orders
        </p>
        <p className="mt-1 text-sm text-slate-500">{message}</p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            Back to dashboard
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 rounded-lg bg-[#002b5b] text-white text-sm font-medium hover:bg-[#001f3f] cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}