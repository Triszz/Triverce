import { useState } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Settings,
  Bell,
  LogOut,
  Store,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/useAuthStore';
import apiClient from '@/lib/apiClient';
import { cn } from '@/lib/cn';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/settings', label: 'Store Settings', icon: Settings },
];

/**
 * SellerLayout — dashboard chrome for the seller admin app.
 *
 * Structure:
 *   • Fixed-width left sidebar with brand, nav links, and logout.
 *   • Right column with a top header (seller identity + notifications)
 *     and a scrollable outlet area on a light slate-50 background.
 *
 * Unlike the buyer-facing `MainLayout` (header / content / footer), this
 * is intentionally admin-style: persistent sidebar over a workspace.
 */
export function SellerLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((p) => p.charAt(0).toUpperCase())
        .slice(0, 2)
        .join('')
    : '?';

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      // The server-side logout endpoint may 401 if the token is already
      // invalid; we still want to clear local state regardless.
      await apiClient.post('/auth/logout', {});
    } catch {
      /* proceed anyway */
    }
    clearAuth();
    toast.success('Logged out');
    navigate('/login');
    setIsLoggingOut(false);
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 bg-[#031140] flex flex-col">
        {/* Brand */}
        <Link
          to="/"
          className="h-16 flex items-center gap-2 px-6"
        >
          <span className="w-9 h-9 rounded-lg bg-white/10 text-white flex items-center justify-center">
            <Store size={18} aria-hidden />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-white">Seller Hub</p>
            <p className="text-xs text-white/50">Triverce</p>
          </div>
        </Link>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:bg-white/10 hover:text-white',
                  )
                }
              >
                <Icon size={18} aria-hidden />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Logout — pinned to bottom */}
        <div className="p-3 border-t border-white/10">
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/10 hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut size={18} aria-hidden />
            {isLoggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </aside>

      {/* ── Main column ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <div>
            <h1 className="text-base font-semibold text-slate-900">
              Welcome back{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}
            </h1>
            <p className="text-xs text-slate-500">
              {user?.role === 'admin' ? 'Administrator' : 'Seller'} dashboard
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Notifications"
              className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <Bell size={18} aria-hidden />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>

            <div className="flex items-center gap-3 pl-3 ml-1 border-l border-slate-200">
              <div className="text-right leading-tight hidden sm:block">
                <p className="text-sm font-medium text-slate-900 truncate max-w-[180px]">
                  {user?.fullName ?? 'Seller'}
                </p>
                <p className="text-xs text-slate-500 truncate max-w-[180px]">
                  {user?.email}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#002b5b] text-white flex items-center justify-center text-sm font-semibold">
                {initials}
              </div>
            </div>
          </div>
        </header>

        {/* Outlet / scrollable content */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default SellerLayout;
