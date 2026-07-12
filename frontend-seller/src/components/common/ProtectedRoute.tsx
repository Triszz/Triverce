import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';

/**
 * Guard for every authenticated route in the seller dashboard.
 *
 * Two checks:
 *  1. The user is signed in (`isAuthenticated`). If not, redirect to
 *     `/login` and remember the page they were trying to reach via
 *     `?redirect=…` so we can send them back after login.
 *  2. The user's role is `seller` OR `admin`. Buyers / customers are
 *     bounced to the buyer frontend (cross-origin absolute URL is safe
 *     here since the apps live on different origins in production).
 */
export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  const isAuthorized =
    Boolean(isAuthenticated && user) &&
    (user!.role === 'seller' || user!.role === 'admin');

  // Redirect wrong-role users to the buyer storefront in an effect so we
  // don't perform a navigation as a render side-effect (which the React
  // Compiler ESLint plugin flags as an immutability violation).
  useEffect(() => {
    if (
      isAuthenticated &&
      user &&
      user.role !== 'seller' &&
      user.role !== 'admin'
    ) {
      window.location.href =
        (import.meta.env.VITE_BUYER_URL as string | undefined) ??
        'http://localhost:5173';
    }
  }, [isAuthenticated, user]);

  if (!isAuthenticated || !user) {
    const redirect = encodeURIComponent(
      `${location.pathname}${location.search}`,
    );
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  if (!isAuthorized) {
    // Render a brief placeholder while the cross-origin redirect runs.
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-500">
        Redirecting to the storefront…
      </div>
    );
  }

  return <Outlet />;
}
