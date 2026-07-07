import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * SlideOver — small "Sheet" / side-drawer primitive.
 *
 * No external deps. Built on top of a React portal so the panel can sit
 * above any stacking context, with a focus-restoring close action and a
 * body-scroll lock while open.
 *
 * Slide-in animation is CSS-only (transform + opacity) so it stays smooth
 * even when the parent uses Tailwind transitions elsewhere.
 */

export interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  /** Header content (rendered inside the panel's sticky top bar). */
  title?: ReactNode;
  /** Right-aligned element in the header (e.g. an "X of Y items" counter). */
  meta?: ReactNode;
  /** Width of the panel. `md` ≈ 28rem, `lg` ≈ 32rem, `xl` ≈ 36rem. */
  size?: 'md' | 'lg' | 'xl';
  /** Body content. */
  children: ReactNode;
  /** Optional footer pinned to the bottom of the panel. */
  footer?: ReactNode;
  /** When true, clicking the backdrop closes the drawer. */
  dismissable?: boolean;
  className?: string;
}

const SIZE: Record<NonNullable<SlideOverProps['size']>, string> = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export function SlideOver({
  open,
  onClose,
  title,
  meta,
  size = 'lg',
  children,
  footer,
  dismissable = true,
  className,
}: SlideOverProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  // Body scroll-lock + focus restore.
  useEffect(() => {
    if (!open) return;

    lastFocusedRef.current = (document.activeElement as HTMLElement) ?? null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevOverflow;
      // Restore focus to whatever opened the drawer.
      lastFocusedRef.current?.focus?.();
    };
  }, [open]);

  // Escape closes the panel.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Move focus into the panel when it opens (first focusable element).
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }, 60);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open) return null;

  const handleBackdropClick = () => {
    if (dismissable) onClose();
  };

  const node = (
    <div
      className="fixed inset-0 z-[100] flex"
      role="presentation"
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close panel"
        tabIndex={-1}
        onClick={handleBackdropClick}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] animate-fade-in"
      />

      {/* Panel */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Side panel'}
        className={cn(
          'relative ml-auto h-full w-full bg-white shadow-2xl flex flex-col',
          // Slide animation: translate-x from 100% to 0.
          'animate-slide-in-right',
          SIZE[size],
          className,
        )}
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-3 px-5 h-14 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-base font-semibold text-slate-900 truncate">
              {title}
            </h2>
            {meta && (
              <span className="text-sm text-slate-500 truncate">{meta}</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={cn(
              'shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-lg',
              'text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#002b5b] focus-visible:ring-offset-2',
            )}
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>

        {/* Footer */}
        {footer && (
          <footer className="border-t border-slate-200 p-5 shrink-0 bg-slate-50">
            {footer}
          </footer>
        )}
      </aside>
    </div>
  );

  return createPortal(node, document.body);
}
