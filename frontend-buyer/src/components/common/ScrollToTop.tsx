import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop — resets the viewport to the top on every route change.
 *
 * Placed inside <BrowserRouter> so it fires for both link navigation
 * and direct URL refreshes.
 */
export function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, search]);

  return null;
}
