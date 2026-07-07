import { Link } from 'react-router-dom';
import { ShoppingBag, Loader2, LogIn } from 'lucide-react';
import { SlideOver } from '@/components/ui/SlideOver';
import { useCart } from '@/hooks/useCart';
import { useUiStore } from '@/stores/useUiStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { CartItemRow } from './CartItemRow';
import { CartSummary } from './CartSummary';

/**
 * CartDrawer — slide-over panel that lists the user's cart.
 *
 * Visibility is driven by `useUiStore.cartDrawerOpen` so any component
 * anywhere in the tree can request it (e.g. the Header cart icon, the
 * Add-to-Cart button on the Product Detail page, a "View cart" link).
 */
export function CartDrawer() {
  const isOpen = useUiStore((s) => s.cartDrawerOpen);
  const close = useUiStore((s) => s.closeCartDrawer);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { cart, totalItems, isLoading, isError } = useCart();

  /* ── Body scroll lock with side-effect ──────────────────────────────── */

  // No-op here — SlideOver manages its own scroll lock.

  /* ── Keep the drawer header counter readable ────────────────────────── */

  const title = totalItems > 0 ? 'Your Cart' : 'Cart';
  const meta = totalItems > 0 ? `${totalItems} ${totalItems === 1 ? 'item' : 'items'}` : null;

  return (
    <SlideOver
      open={isOpen}
      onClose={close}
      title={title}
      meta={meta}
      size="lg"
      footer={
        isAuthenticated && totalItems > 0 ? (
          <CartSummary compact checkoutHref="/checkout" onCheckout={close} />
        ) : undefined
      }
    >
      {/* Body content */}
      {!isAuthenticated ? (
        <NotSignedIn onClose={close} />
      ) : isLoading ? (
        <DrawerSkeleton />
      ) : isError ? (
        <DrawerError />
      ) : !cart || cart.items.length === 0 ? (
        <EmptyCart onClose={close} />
      ) : (
        <ul role="list" className="px-5 divide-y divide-slate-100">
          {cart.items.map((item) => (
            <CartItemRow
              key={item.id}
              item={item}
              compact
              onNavigate={close}
            />
          ))}
        </ul>
      )}

      {/* Footer-area "View full cart" link (only when items present) */}
      {isAuthenticated && !isLoading && cart && cart.items.length > 0 && (
        <div className="border-t border-slate-100 bg-white px-5 py-3 text-center -mt-px">
          <Link
            to="/cart"
            onClick={close}
            className="text-xs font-medium text-[#002b5b] hover:text-[#001f3f] transition-colors"
          >
            View full cart
          </Link>
        </div>
      )}
    </SlideOver>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Inner states — kept colocated to avoid spreading tiny UI files around.
 * ──────────────────────────────────────────────────────────────────────── */

function NotSignedIn({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center h-full px-6 gap-4">
      <div className="h-14 w-14 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center">
        <LogIn size={22} aria-hidden />
      </div>
      <div className="space-y-1.5 max-w-xs">
        <h3 className="text-base font-semibold text-slate-900">
          Sign in to view your cart
        </h3>
        <p className="text-sm text-slate-500">
          Your cart is saved to your account so it follows you across
          devices.
        </p>
      </div>
      <Link
        to="/auth/login"
        onClick={onClose}
        className="inline-flex items-center justify-center rounded-lg bg-[#002b5b] px-5 h-11 text-sm font-medium text-white hover:bg-[#001f3f] transition-colors"
      >
        Sign in
      </Link>
      <Link
        to="/auth/register"
        onClick={onClose}
        className="text-xs font-medium text-slate-500 hover:text-[#002b5b] transition-colors"
      >
        New here? Create an account
      </Link>
    </div>
  );
}

function EmptyCart({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center h-full px-6 gap-4">
      <div className="h-14 w-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
        <ShoppingBag size={22} aria-hidden />
      </div>
      <div className="space-y-1.5 max-w-xs">
        <h3 className="text-base font-semibold text-slate-900">
          Your cart is empty
        </h3>
        <p className="text-sm text-slate-500">
          Browse the shop to start adding items to your cart.
        </p>
      </div>
      <Link
        to="/shop"
        onClick={onClose}
        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-5 h-11 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        Browse products
      </Link>
    </div>
  );
}

function DrawerSkeleton() {
  // Lightweight skeleton — Avoid coupling to the project's Skeleton primitive so
  // we don't get caught up in transitions if the design changes.
  return (
    <div className="px-5 py-5 space-y-5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className="h-16 w-16 rounded-lg bg-slate-100" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-3 w-2/3 rounded bg-slate-100" />
            <div className="h-3 w-1/3 rounded bg-slate-100" />
            <div className="mt-3 h-7 w-24 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DrawerError() {
  return (
    <div className="flex items-center gap-2 px-5 py-4 text-sm text-danger-700 bg-danger-50 border-b border-danger-500/20">
      <Loader2 size={14} className="animate-spin" aria-hidden />
      Couldn't load your cart. Please close and try again.
    </div>
  );
}
