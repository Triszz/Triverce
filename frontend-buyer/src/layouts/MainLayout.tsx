import { Outlet } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { CartDrawer } from '../components/cart/CartDrawer';

/**
 * MainLayout — buyer-facing pages.
 *
 * Wraps every protected/buyer route with the standard header/footer shell
 * and mounts the slide-over `<CartDrawer />` once at the top of the tree
 * so any descendant can request it via `useUiStore.openCartDrawer()`.
 */
function MainLayout() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
    </div>
  );
}

export default MainLayout;
