import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';

/**
 * ProductsListPage — placeholder listing surface.
 *
 * The full CRUD UI lands in a follow-up phase. For now this anchors
 * the `/products` route in the sidebar so navigation can be designed
 * without a redirect to a 404.
 */
export function ProductsListPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Products</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your catalog, inventory, and pricing.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-6 py-16 text-center">
          <span className="inline-flex w-14 h-14 rounded-full bg-slate-100 items-center justify-center mb-4">
            <Package size={22} className="text-slate-500" aria-hidden />
          </span>
          <h2 className="text-lg font-semibold text-slate-900">
            Product management coming soon
          </h2>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
            We&apos;re wiring up the catalog, inventory sync, and bulk
            editing tools. Check back shortly.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg bg-[#002b5b] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#001f3f] transition-colors mt-6"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
