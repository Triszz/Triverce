import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Logo } from '../common/Logo';

function Header() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-8">

          {/* Logo */}
          <Link
            to="/"
            className="shrink-0"
          >
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

            <Link
              to="/cart"
              className="relative text-slate-600 hover:text-[#002b5b] transition-colors p-2 rounded-lg hover:bg-slate-50"
              aria-label="Cart"
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
                  d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
                />
              </svg>
              {/* Cart badge — shown when cart has items */}
              <span className="absolute -top-0.5 -right-0.5 bg-[#002b5b] text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                0
              </span>
            </Link>

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
          </nav>
        </div>

        {/* Mobile search bar */}
        <form
          onSubmit={handleSearch}
          className="sm:hidden pb-3"
        >
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
