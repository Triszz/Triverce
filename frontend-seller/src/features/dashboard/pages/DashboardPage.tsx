import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  DollarSign,
  Package,
  ShoppingBag,
  Users,
} from 'lucide-react';
import { formatVnd } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import { RevenueChartCard } from '../components/RevenueChartCard';
import { OrderStatusBadge } from '@/features/orders/components/OrderStatusBadge';

/* ──────────────────────────────────────────────────────────────────────────
 * Metric card
 *
 * Renders a label + value + icon. When `isLoading`, the value area is
 * replaced by an animated skeleton bar so the card's height stays constant.
 * `StatCardSkeleton` is a drop-in visual replacement for the entire card
 * so the loading state doesn't have to know about the card's internal
 * structure.
 * ────────────────────────────────────────────────────────────────────────── */

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon: typeof DollarSign;
  accent: 'brand' | 'success' | 'warning' | 'info';
  borderClass?: string;
  isLoading?: boolean;
}

const ACCENT_CLASSES: Record<StatCardProps['accent'], string> = {
  brand: 'bg-blue-600/10 text-blue-600',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  info: 'bg-indigo-50 text-indigo-600',
};

const BORDER_CLASSES: Record<StatCardProps['accent'], string> = {
  brand: 'border-t-blue-500',
  success: 'border-t-emerald-500',
  warning: 'border-t-amber-500',
  info: 'border-t-indigo-500',
};

function StatCard({ label, value, icon: Icon, accent, borderClass, isLoading }: StatCardProps): ReactNode {
  return (
    <div className={cn(
      'bg-white rounded-xl border border-slate-200 border-t-4 shadow-sm p-5',
      BORDER_CLASSES[accent],
      borderClass,
    )}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500 font-medium">{label}</p>
        <span
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            ACCENT_CLASSES[accent],
          )}
        >
          <Icon size={18} aria-hidden />
        </span>
      </div>
      {isLoading ? (
        <SkeletonBar />
      ) : (
        <p className="text-2xl font-bold text-slate-900 tracking-tight">{value}</p>
      )}
    </div>
  );
}

/** Animated skeleton bar — used inside stat cards and the recent-orders list. */
function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-7 rounded-md bg-slate-100 animate-pulse',
        className,
      )}
      aria-hidden
    />
  );
}

/** Full-card skeleton — mirrors the StatCard layout. */
function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <SkeletonBar className="w-28 h-4" />
        <div className="w-10 h-10 rounded-lg bg-slate-100 animate-pulse" />
      </div>
      <SkeletonBar className="w-36" />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Quick-action card
 * ────────────────────────────────────────────────────────────────────────── */

interface QuickActionProps {
  to: string;
  label: string;
  description: string;
}

function QuickAction({ to, label, description }: QuickActionProps) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-[#002b5b] hover:shadow-sm transition-all group"
    >
      <div>
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
      <ArrowRight
        size={14}
        className="text-slate-400 group-hover:text-[#002b5b] shrink-0 transition-colors"
        aria-hidden
      />
    </Link>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Date formatter for the recent-orders list
 * ────────────────────────────────────────────────────────────────────────── */

function formatOrderDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * DashboardPage
 * ────────────────────────────────────────────────────────────────────────── */

export function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = useDashboardMetrics();
  const metrics = data?.data;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          An overview of your storefront performance.
        </p>
      </div>

      {/* Error banner — shown before the card grid so the cards below
          still render (they'll show 0 / skeletons). */}
      {isError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={16} className="text-red-600 shrink-0" aria-hidden />
          <p className="flex-1 text-sm text-red-700">
            {(error as Error)?.message ?? 'Failed to load dashboard metrics.'}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="shrink-0 text-xs font-medium text-red-600 hover:text-red-800 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Metric cards — four columns, each collapses gracefully when loading. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Sales (30d)"
          value={metrics ? formatVnd(metrics.totalSales) : <SkeletonBar className="w-36" />}
          icon={DollarSign}
          accent="success"
          isLoading={isLoading}
        />
        <StatCard
          label="Active Orders"
          value={metrics ? metrics.activeOrders.toLocaleString() : <SkeletonBar className="w-20" />}
          icon={ShoppingBag}
          accent="brand"
          isLoading={isLoading}
        />
        <StatCard
          label="Listed Products"
          value={metrics ? metrics.listedProducts.toLocaleString() : <SkeletonBar className="w-20" />}
          icon={Package}
          accent="info"
          isLoading={isLoading}
        />
        <StatCard
          label="Customers"
          value={metrics ? metrics.totalCustomers.toLocaleString() : <SkeletonBar className="w-20" />}
          icon={Users}
          accent="warning"
          isLoading={isLoading}
        />
      </div>

      {/* Revenue over time — full-width area chart, placed just above
          the recent-orders + quick-actions row. */}
      <RevenueChartCard
        data={metrics?.revenueChart ?? []}
        isLoading={isLoading}
      />

      {/* Two-column lower section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent orders */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Recent orders
            </h2>
            <Link
              to="/orders"
              className="text-xs font-medium text-[#002b5b] hover:text-[#001f3f] flex items-center gap-1 cursor-pointer"
            >
              View all <ArrowRight size={12} aria-hidden />
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <SkeletonBar className="w-24 h-4" />
                  <SkeletonBar className="w-32 h-4" />
                  <SkeletonBar className="w-16 h-4 ml-auto" />
                  <SkeletonBar className="w-20 h-5 rounded-full" />
                </div>
              ))}
            </div>
          ) : metrics?.recentOrders.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No recent orders yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {metrics?.recentOrders.map((order) => (
                <li
                  key={order.id}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  {/* Order id */}
                  <span className="text-xs font-mono font-medium text-slate-700 w-24 shrink-0">
                    #{order.id.slice(0, 8)}
                  </span>
                  {/* Customer */}
                  <span className="text-sm font-medium text-slate-900 flex-1 truncate">
                    {order.shippingName}
                  </span>
                  {/* Date */}
                  <span className="text-xs text-slate-500 shrink-0">
                    {formatOrderDate(order.createdAt)}
                  </span>
                  {/* Total */}
                  <span className="text-sm font-semibold text-slate-900 tabular-nums shrink-0">
                    {formatVnd(order.totalAmount)}
                  </span>
                  {/* Status */}
                  <span className="shrink-0">
                    <OrderStatusBadge status={order.status} size="sm" />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-1">
            Quick actions
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Jump straight into your most-used flows.
          </p>
          <div className="space-y-3">
            <QuickAction
              to="/products/new"
              label="Add a product"
              description="List a new item in your catalog."
            />
            <QuickAction
              to="/orders"
              label="Fulfill orders"
              description="Process pending shipments."
            />
            <QuickAction
              to="/settings"
              label="Store settings"
              description="Update branding and policies."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
