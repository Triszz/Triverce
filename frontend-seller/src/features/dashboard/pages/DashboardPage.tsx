import { Link } from 'react-router-dom';
import { DollarSign, ShoppingBag, Package, Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string;
  delta?: string;
  icon: typeof DollarSign;
  accent: 'brand' | 'success' | 'warning' | 'info';
}

const ACCENT_CLASSES: Record<StatCardProps['accent'], string> = {
  brand: 'bg-[#002b5b]/10 text-[#002b5b]',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  info: 'bg-sky-50 text-sky-600',
};

function StatCard({ label, value, delta, icon: Icon, accent }: StatCardProps): ReactNode {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
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
      <p className="text-2xl font-bold text-slate-900 tracking-tight">{value}</p>
      {delta && (
        <p className="mt-1 text-xs text-emerald-600 font-medium">{delta}</p>
      )}
    </div>
  );
}

interface QuickActionProps {
  to: string;
  label: string;
  description: string;
}

function QuickAction({ to, label, description }: QuickActionProps) {
  return (
    <Link
      to={to}
      className="block p-4 bg-white rounded-xl border border-slate-200 hover:border-[#002b5b] hover:shadow-sm transition-all"
    >
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </Link>
  );
}

/**
 * DashboardPage — landing page inside SellerLayout.
 *
 * Phase 1 view: static placeholder cards so the chrome can be designed
 * against real layout before the analytics hook lands.
 */
export function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          An overview of your storefront performance.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Sales (30d)"
          value="$0"
          icon={DollarSign}
          accent="success"
        />
        <StatCard
          label="Active Orders"
          value="0"
          icon={ShoppingBag}
          accent="brand"
        />
        <StatCard
          label="Listed Products"
          value="0"
          icon={Package}
          accent="info"
        />
        <StatCard
          label="Customers"
          value="0"
          icon={Users}
          accent="warning"
        />
      </div>

      {/* Recent activity placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-900">
            Recent orders
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Latest customer activity will appear here.
          </p>
          <div className="mt-6 border-t border-slate-100 pt-6 text-center text-sm text-slate-400">
            No recent orders yet.
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-900">
            Quick actions
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Jump straight into your most-used flows.
          </p>
          <div className="mt-4 space-y-3">
            <QuickAction
              to="/products"
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
