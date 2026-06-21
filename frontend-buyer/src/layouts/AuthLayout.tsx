import { Outlet } from 'react-router-dom';
import { Link } from 'react-router-dom';

function AuthLayout() {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left panel — brand / decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#002b5b] flex-col justify-between p-12">
        <Link to="/" className="text-white font-bold text-2xl tracking-tight">
          Triverce
        </Link>

        <div className="space-y-6">
          <h1 className="text-white text-4xl font-bold leading-tight">
            Shop confidently<br />from trusted sellers.
          </h1>
          <p className="text-blue-200 text-lg leading-relaxed max-w-md">
            Discover thousands of verified sellers, compare prices, and enjoy
            seamless checkout — all in one premium marketplace.
          </p>
        </div>

        <p className="text-blue-300 text-sm">
          &copy; {new Date().getFullYear()} Triverce. All rights reserved.
        </p>
      </div>

      {/* Right panel — auth form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <Link
            to="/"
            className="lg:hidden text-[#002b5b] font-bold text-2xl tracking-tight mb-8 block text-center"
          >
            Triverce
          </Link>

          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
