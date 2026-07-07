import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Package, LogOut, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "../common/Logo";
import { useAuthStore } from "../../stores/useAuthStore";
import { useUiStore } from "../../stores/useUiStore";
import { useCart } from "../../hooks/useCart";
import { authService } from "../../services/authService";
import { cn } from "@/lib/cn";

function Header() {
  const navigate = useNavigate();
  const { isAuthenticated, user, clearAuth } = useAuthStore();
  const openCartDrawer = useUiStore((s) => s.openCartDrawer);
  const { totalItems } = useCart();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogout = async () => {
    setIsDropdownOpen(false);
    try {
      await authService.logout();
    } catch {
      // Backend logout endpoint may return 401 if token is already invalid;
      // proceed with local clear regardless.
    }
    clearAuth();
    toast.success("Logged out successfully");
    navigate("/auth/login");
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initials = user?.fullName ? user.fullName.charAt(0).toUpperCase() : "?";

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-8">
          {/* Logo */}
          <Link to="/" className="shrink-0">
            <Logo />
          </Link>

          {/* Search bar */}
          <form
            onSubmit={handleSearch}
            className="flex-1 max-w-xl hidden sm:flex"
          >
            <div className="relative w-full">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, brands, or sellers..."
                className="w-full rounded-full border border-slate-200 bg-slate-50 px-5 py-2.5 pr-12 text-sm text-slate-900 placeholder-slate-400 focus:border-[#002b5b] focus:outline-none focus:ring-2 focus:ring-[#002b5b]/20 transition-colors"
              />
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#002b5b] transition-colors"
                aria-label="Search"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                  />
                </svg>
              </button>
            </div>
          </form>

          {/* Nav actions */}
          <nav className="flex items-center gap-2 sm:gap-4 shrink-0">
            <Link
              to="/shop"
              className="text-sm font-medium text-slate-600 hover:text-[#002b5b] transition-colors hidden sm:block"
            >
              Shop
            </Link>

            <button
              type="button"
              onClick={openCartDrawer}
              aria-label={`Open cart (${totalItems} ${totalItems === 1 ? 'item' : 'items'})`}
              className="relative text-slate-600 hover:text-[#002b5b] transition-colors p-2 rounded-lg hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#002b5b]"
            >
              <ShoppingCart size={20} aria-hidden />
              {/* Cart badge — only rendered when cart has items */}
              {totalItems > 0 && (
                <span
                  className={cn(
                    "absolute -top-0.5 -right-0.5 bg-[#002b5b] text-white text-[10px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center leading-none ring-2 ring-white",
                    totalItems > 99 && "px-1.5",
                  )}
                  aria-hidden
                >
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </button>

            {!isAuthenticated ? (
              <>
                <Link
                  to="/auth/login"
                  className="text-sm font-medium text-slate-600 hover:text-[#002b5b] transition-colors hidden sm:block"
                >
                  Sign in
                </Link>

                <Link
                  to="/auth/register"
                  className="rounded-lg bg-[#002b5b] px-4 py-2 text-sm font-medium text-white hover:bg-[#001f3f] transition-colors"
                >
                  Get Started
                </Link>
              </>
            ) : (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  className="w-10 h-10 rounded-full bg-[#002b5b] text-white flex items-center justify-center text-sm font-semibold hover:bg-[#001f3f] transition-colors focus:outline-none focus:ring-2 focus:ring-[#002b5b]/40 cursor-pointer"
                  aria-label="User menu"
                  aria-expanded={isDropdownOpen}
                >
                  {initials}
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-slate-200 z-50 py-1">
                    <div className="px-4 py-2.5 border-b border-slate-100">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {user?.fullName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {user?.email}
                      </p>
                    </div>

                    <Link
                      to="/profile"
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <User size={15} className="text-slate-400 shrink-0" />
                      My Profile
                    </Link>

                    <Link
                      to="/orders"
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Package size={15} className="text-slate-400 shrink-0" />
                      My Orders
                    </Link>

                    <Link
                      to="/cart"
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <ShoppingCart size={15} className="text-slate-400 shrink-0" />
                      My Cart
                    </Link>

                    <div className="border-t border-slate-100 my-1" />

                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <LogOut size={15} className="shrink-0" />
                      Log out
                    </button>
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>

        {/* Mobile search bar */}
        <form onSubmit={handleSearch} className="sm:hidden pb-3">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-[#002b5b] focus:outline-none focus:ring-2 focus:ring-[#002b5b]/20 transition-colors"
          />
        </form>
      </div>
    </header>
  );
}

export default Header;
