import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { SellerLayout } from '@/components/layout/SellerLayout';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { ProductsListPage } from '@/features/products/pages/ProductsListPage';
import { ProductCreatePage } from '@/features/products/pages/ProductCreatePage';
import { ProductEditPage } from '@/features/products/pages/ProductEditPage';
import { OrdersListPage } from '@/features/orders/pages/OrdersListPage';
import { OrderDetailPage } from '@/features/orders/pages/OrderDetailPage';
import { StoreSettingsPage } from '@/features/settings/pages/StoreSettingsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected — wraps every authenticated route in the dashboard
            chrome AND enforces the seller/admin role gate. */}
        <Route element={<ProtectedRoute />}>
          <Route element={<SellerLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="products" element={<ProductsListPage />} />
            <Route path="products/new" element={<ProductCreatePage />} />
            <Route path="products/:id/edit" element={<ProductEditPage />} />
            <Route path="orders" element={<OrdersListPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
            <Route path="settings" element={<StoreSettingsPage />} />
          </Route>
        </Route>

        {/* Fallback — bounce everything unknown back to /login (which
            will then redirect to / if the user is already signed in). */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
