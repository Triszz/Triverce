import { useNavigate } from 'react-router-dom';
import { Loader2, LogIn, ArrowRight, ShoppingCart } from 'lucide-react';
import { CartItemRow } from '@/components/cart/CartItemRow';
import { CartSummary } from '@/components/cart/CartSummary';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageMeta } from '@/components/common/PageMeta';
import { useCart } from '@/hooks/useCart';
import { useAuthStore } from '@/stores/useAuthStore';

/**
 * CartPage — full-page fallback for /cart.
 *
 * Reuses the same primitives as the slide-over drawer so the two views
 * stay visually consistent. The drawer is the primary surface; this
 * page exists for users who want to see (and tweak) their cart on a
 * dedicated page.
 */
export function CartPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { cart, totalItems, isLoading, isError } = useCart();

  /* ── Auth-gate ─────────────────────────────────────────────────────── */

  if (!isAuthenticated) {
    return (
      <>
        <PageMeta title="My cart" description="View the items in your cart." />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <EmptyState
            tone="brand"
            icon={<LogIn size={24} aria-hidden />}
            title="Sign in to view your cart"
            description="Your cart is tied to your account, so we can keep it safe across devices."
            actions={[
              {
                label: 'Sign in',
                href: '/auth/login',
                variant: 'primary',
              },
              {
                label: 'Create account',
                href: '/auth/register',
                variant: 'secondary',
              },
            ]}
          />
        </div>
      </>
    );
  }

  /* ── Loading ───────────────────────────────────────────────────────── */

  if (isLoading) {
    return (
      <>
        <PageMeta title="My cart" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6">
            Your Cart
          </h1>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
            <div className="lg:col-span-1">
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ── Error ─────────────────────────────────────────────────────────── */

  if (isError) {
    return (
      <>
        <PageMeta title="My cart" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <EmptyState
            tone="danger"
            icon={<Loader2 size={24} aria-hidden />}
            title="Couldn't load your cart"
            description="Please refresh the page to try again."
            actions={[
              {
                label: 'Refresh',
                onClick: () => window.location.reload(),
                variant: 'primary',
              },
            ]}
          />
        </div>
      </>
    );
  }

  /* ── Empty ─────────────────────────────────────────────────────────── */

  if (!cart || cart.items.length === 0) {
    return (
      <>
        <PageMeta
          title="My cart"
          description="Review and checkout the items in your Triverce cart."
        />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <EmptyState
            tone="brand"
            icon={<ShoppingCart size={28} aria-hidden />}
            title="Your cart is empty"
            description="Browse the shop to start adding items to your cart."
            actions={[
              {
                label: 'Start shopping',
                onClick: () => navigate('/shop'),
                variant: 'primary',
                leftIcon: <ArrowRight size={14} aria-hidden />,
              },
            ]}
          />
        </div>
      </>
    );
  }

  /* ── Cart content ──────────────────────────────────────────────────── */

  return (
    <>
      <PageMeta
        title="My cart"
        description="Review and checkout the items in your Triverce cart."
      />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Your Cart</h1>
          <p className="text-sm text-slate-500 mt-1">
            {totalItems} {totalItems === 1 ? 'item' : 'items'} ready for checkout
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items */}
        <section
          aria-label="Cart items"
          className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm px-4 sm:px-6"
        >
          <ul role="list" className="divide-y divide-slate-100">
            {cart.items.map((item) => (
              <CartItemRow key={item.id} item={item} />
            ))}
          </ul>
        </section>

        {/* Summary */}
        <aside
          aria-label="Order summary"
          className="lg:col-span-1"
        >
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 lg:sticky lg:top-24">
            <h2 className="text-base font-semibold text-slate-900 mb-4">
              Order summary
            </h2>
            <CartSummary checkoutHref="/checkout" />
          </div>
        </aside>
      </div>
    </div>
    </>
  );
}
