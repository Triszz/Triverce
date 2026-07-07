import { useNavigate } from 'react-router-dom';
import { SearchX, ArrowLeft, ShoppingBag } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageMeta } from '@/components/common/PageMeta';

/* ──────────────────────────────────────────────────────────────────────────
 * NotFoundPage — 404.
 *
 * Renders inside whatever layout the route is nested under (typically
 * `BuyerLayout` for the catch-all). Uses the shared `EmptyState` so the
 * "we couldn't find what you wanted" moment is consistent with the
 * other empty moments in the app (empty cart, empty orders, …).
 * ─────────────────────────────────────────────── */

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <>
      <PageMeta
        title="Page not found"
        description="The page you're looking for doesn't exist or has been moved."
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <EmptyState
          tone="neutral"
          icon={<SearchX size={28} aria-hidden />}
          title="We couldn't find that page"
          description="The link may be broken, or the page may have been moved. Let's get you back on track."
          actions={[
            {
              label: 'Back to home',
              onClick: () => navigate('/'),
              variant: 'primary',
              leftIcon: <ArrowLeft size={14} aria-hidden />,
            },
            {
              label: 'Browse the shop',
              onClick: () => navigate('/shop'),
              variant: 'secondary',
              leftIcon: <ShoppingBag size={14} aria-hidden />,
            },
          ]}
        />
      </div>
    </>
  );
}
