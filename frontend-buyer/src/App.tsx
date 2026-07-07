import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';
import { PageSuspense } from './components/ui/PageSuspense';

/* ──────────────────────────────────────────────────────────────────────────
 * Code-split every top-level page.
 *
 * Each page sits in its own chunk, so the initial bundle only has to
 * download the routes the user actually lands on. The matching
 * `<PageSuspense variant=… />` fallback matches the page's shape so the
 * first paint feels instant even on a cold cache.
 *
 * Critical-path pages (`/`, the auth pages) are still lazy — the savings
 * come from the fact that, e.g. the checkout/orders/account JS only
 * gets fetched when the user actually navigates there.
 * ───────────────────────────────────────── */

const HomePage = lazy(() =>
  import('./pages/HomePage').then((m) => ({ default: m.HomePage })),
);
const ShopPage = lazy(() =>
  import('./pages/ShopPage').then((m) => ({ default: m.ShopPage })),
);
const ProductDetailPage = lazy(() =>
  import('./pages/ProductDetailPage').then((m) => ({
    default: m.ProductDetailPage,
  })),
);
const CartPage = lazy(() =>
  import('./pages/CartPage').then((m) => ({ default: m.CartPage })),
);
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);

const AccountPage = lazy(() =>
  import('./features/account/pages/AccountPage').then((m) => ({
    default: m.AccountPage,
  })),
);

const MyOrdersPage = lazy(() =>
  import('./features/orders/pages/MyOrdersPage').then((m) => ({
    default: m.MyOrdersPage,
  })),
);
const OrderDetailPage = lazy(() =>
  import('./features/orders/pages/OrderDetailPage').then((m) => ({
    default: m.OrderDetailPage,
  })),
);

const CheckoutPage = lazy(() =>
  import('./features/checkout/pages/CheckoutPage').then((m) => ({
    default: m.CheckoutPage,
  })),
);
const PaymentReturnPage = lazy(() =>
  import('./features/checkout/pages/PaymentReturnPage').then((m) => ({
    default: m.PaymentReturnPage,
  })),
);

const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
  import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })),
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth routes — split-screen layout */}
        <Route element={<AuthLayout />}>
          <Route
            path="/auth/login"
            element={
              <Suspense fallback={<PageSuspense variant="auth" />}>
                <LoginPage />
              </Suspense>
            }
          />
          <Route
            path="/auth/register"
            element={
              <Suspense fallback={<PageSuspense variant="auth" />}>
                <RegisterPage />
              </Suspense>
            }
          />
        </Route>

        {/* Buyer-facing routes — main layout with header/footer */}
        <Route element={<MainLayout />}>
          <Route
            path="/"
            element={
              <Suspense fallback={<PageSuspense />}>
                <HomePage />
              </Suspense>
            }
          />
          <Route
            path="/shop"
            element={
              <Suspense fallback={<PageSuspense />}>
                <ShopPage />
              </Suspense>
            }
          />
          <Route
            path="/product/:productId"
            element={
              <Suspense fallback={<PageSuspense variant="detail" />}>
                <ProductDetailPage />
              </Suspense>
            }
          />
          <Route
            path="/cart"
            element={
              <Suspense fallback={<PageSuspense />}>
                <CartPage />
              </Suspense>
            }
          />
          <Route
            path="/checkout"
            element={
              <Suspense fallback={<PageSuspense variant="detail" />}>
                <CheckoutPage />
              </Suspense>
            }
          />
          <Route
            path="/checkout/return"
            element={
              <Suspense fallback={<PageSuspense />}>
                <PaymentReturnPage />
              </Suspense>
            }
          />
          <Route
            path="/orders"
            element={
              <Suspense fallback={<PageSuspense variant="list" />}>
                <MyOrdersPage />
              </Suspense>
            }
          />
          <Route
            path="/orders/:orderId"
            element={
              <Suspense fallback={<PageSuspense variant="detail" />}>
                <OrderDetailPage />
              </Suspense>
            }
          />
          <Route
            path="/profile"
            element={
              <Suspense fallback={<PageSuspense variant="account" />}>
                <AccountPage />
              </Suspense>
            }
          />

          {/* Dev-only — UI primitives smoke test */}
          <Route
            path="/dev/ui"
            element={
              <Suspense fallback={<PageSuspense />}>
                <PageSuspense />
              </Suspense>
            }
          />

          {/* 404 — still inside the buyer shell so the header / footer /
              cart drawer are visible. */}
          <Route
            path="*"
            element={
              <Suspense fallback={<PageSuspense />}>
                <NotFoundPage />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
