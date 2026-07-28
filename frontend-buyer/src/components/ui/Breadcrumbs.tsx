import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

export interface Crumb {
  label: string;
  path?: string;
}

export interface BreadcrumbsProps {
  crumbs: Crumb[];
  className?: string;
}

/**
 * Reusable breadcrumb trail.
 *
 * Usage:
 *   <Breadcrumbs crumbs={[{ label: 'Home', path: '/' }, { label: 'Shop', path: '/shop' }, { label: product.name }]} />
 *
 * - All items except the last (current page) are clickable links.
 * - The last item is rendered as plain text in a darker tone.
 */
export function Breadcrumbs({ crumbs, className }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center gap-1.5 text-sm text-slate-500 flex-wrap', className)}
    >
      <ol className="flex items-center gap-1.5 flex-wrap">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <li key={index} className="flex items-center gap-1.5">
              {index > 0 && (
                <span aria-hidden className="text-slate-300 select-none">
                  /
                </span>
              )}
              {isLast || !crumb.path ? (
                <span
                  className={cn(
                    isLast
                      ? 'text-slate-900 font-medium cursor-default'
                      : 'text-slate-500',
                  )}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.path}
                  className="hover:text-slate-900 transition-colors cursor-pointer"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
