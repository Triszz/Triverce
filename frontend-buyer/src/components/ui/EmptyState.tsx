import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/* ──────────────────────────────────────────────────────────────────────────
 * EmptyState — the canonical "no data" primitive.
 *
 * Use this everywhere a list, grid, or section has nothing to show
 * (empty cart, no search results, no orders, no categories…). The goal
 * is to make the empty moment feel intentional and inviting, not dead.
 *
 * Anatomy:
 *   ┌──────────────────────────────┐
 *   │   [icon — circular badge]    │
 *   │   Headline (h2)              │
 *   │   Subheadline (description)  │
 *   │   [primary CTA] [secondary]  │
 *   └──────────────────────────────┘
 *
 * Variants:
 *   • `size="sm"` — for compact in-card empty areas (e.g. cart list)
 *   • `size="md"` — for full-page / section empty states (default)
 *
 * Tone:
 *   • `tone="neutral"` — slate (default, safe for any context)
 *   • `tone="brand"`   — brand-coloured badge for "try this instead"
 *   • `tone="danger"`  — for blocked / forbidden states
 *
 * Actions API:
 *   Provide either `onClick` (callers usually use `useNavigate` for SPA
 *   transitions) OR `href` (plain anchor). Don't pass both.
 * ──────────────────────────────────────────────────────────────────────── */

export interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  leftIcon?: ReactNode;
}

export interface EmptyStateProps {
  /** Optional Lucide icon or custom element rendered inside a circular badge. */
  icon?: ReactNode;
  /** Primary headline — typically 1 short sentence. */
  title: string;
  /** Optional supporting copy, 1–2 sentences. */
  description?: string;
  /** Up to two CTAs. */
  actions?: EmptyStateAction[];
  /** Layout density. */
  size?: 'sm' | 'md';
  /** Badge tone for the icon background + text. */
  tone?: 'neutral' | 'brand' | 'danger';
  className?: string;
}

const ICON_WRAP: Record<NonNullable<EmptyStateProps['tone']>, string> = {
  neutral: 'bg-slate-100 text-slate-500',
  brand: 'bg-brand-50 text-[#002b5b]',
  danger: 'bg-danger-50 text-danger-600',
};

const ACTION_STYLES: Record<NonNullable<EmptyStateAction['variant']>, string> = {
  primary:
    'inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#002b5b] px-5 h-11 text-sm font-medium text-white hover:bg-[#001f3f] transition-colors',
  secondary:
    'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-5 h-11 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors',
  ghost:
    'inline-flex items-center justify-center gap-1.5 rounded-lg px-4 h-11 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors',
};

function ActionButton({ action }: { action: EmptyStateAction }) {
  const styleClass = ACTION_STYLES[action.variant ?? 'primary'];
  const content = (
    <>
      {action.leftIcon}
      {action.label}
    </>
  );

  if (action.href) {
    return (
      <a href={action.href} className={styleClass}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={styleClass}>
      {content}
    </button>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  actions = [],
  size = 'md',
  tone = 'neutral',
  className,
}: EmptyStateProps) {
  const isSm = size === 'sm';
  const iconSize = isSm ? 'h-12 w-12' : 'h-16 w-16';
  const iconInnerSize = isSm ? 20 : 28;
  const titleSize = isSm ? 'text-lg' : 'text-2xl';
  const wrapperPadding = isSm ? 'py-10' : 'py-16';

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        wrapperPadding,
        className,
      )}
    >
      {icon && (
        <div
          className={cn(
            'inline-flex items-center justify-center rounded-full mb-4',
            iconSize,
            ICON_WRAP[tone],
          )}
        >
          {/* Wrap icon in a fixed-size span so callers can pass a Lucide
              icon at any size — we visually clamp it. */}
          <span
            aria-hidden
            style={{ width: iconInnerSize, height: iconInnerSize }}
            className="inline-flex items-center justify-center"
          >
            {icon}
          </span>
        </div>
      )}

      <h2 className={cn('font-bold text-slate-900', titleSize)}>{title}</h2>

      {description && (
        <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-md">
          {description}
        </p>
      )}

      {actions.length > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row gap-2 sm:gap-3">
          {actions.map((action) => (
            <ActionButton key={action.label} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}
