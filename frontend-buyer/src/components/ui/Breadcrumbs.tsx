import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

export interface Crumb {
  label: string;
  path?: string;
}

export interface BreadcrumbsProps {
  crumbs: Crumb[];
  className?: string;
  /** 'light' renders on dark backgrounds (e.g. inside a navy hero banner). Defaults to 'dark'. */
  theme?: 'light' | 'dark';
}

/**
 * Reusable breadcrumb trail.
 *
 * Usage:
 *   <Breadcrumbs crumbs={[{ label: 'Home', path: '/' }, { label: 'Shop', path: '/shop' }, { label: product.name }]} />
 *   <Breadcrumbs crumbs={[{ label: 'Home', path: '/' }, { label: displayName }]} theme="light" />
 *
 * - All items except the last (current page) are clickable links.
 * - The last item is rendered as plain text in a darker tone.
 * - `theme="light"` switches to pale colours suitable for dark backgrounds.
 */
export function Breadcrumbs({ crumbs, className, theme = 'dark' }: BreadcrumbsProps) {
  const isLight = theme === 'light';

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        'flex items-center gap-1.5 text-sm flex-wrap',
        isLight ? 'text-slate-300' : 'text-slate-500',
        className,
      )}
    >
      <ol className="flex items-center gap-1.5 flex-wrap">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <li key={index} className="flex items-center gap-1.5">
              {index > 0 && (
                <span aria-hidden className={cn(isLight ? 'text-slate-500' : 'text-slate-300', 'select-none')}>
                  /
                </span>
              )}
              {isLast || !crumb.path ? (
                <span
                  className={cn(
                    isLast
                      ? isLight
                        ? 'text-white font-medium cursor-default'
                        : 'text-slate-900 font-medium cursor-default'
                      : isLight
                        ? 'text-slate-300'
                        : 'text-slate-500',
                  )}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.path}
                  className={cn(
                    'transition-colors cursor-pointer',
                    isLight
                      ? 'hover:text-white'
                      : 'hover:text-slate-900',
                  )}
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
