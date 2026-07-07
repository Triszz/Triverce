import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

/* ──────────────────────────────────────────────────────────────────────────
 * Modal — small, accessible, centered dialog primitive.
 *
 * Built on a React portal so the panel sits above any stacking context
 * and uses the same focus-restore + body-scroll-lock + Escape-to-close
 * pattern as `<SlideOver>`. Use this for short, focused flows (confirm
 * a destructive action, capture a single text input, etc.). For richer
 * content that needs its own scroll context, prefer `<SlideOver>`.
 * ──────────────────────────────────────────────────────────────────────── */

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Header content. Plain string is rendered as an <h2>. */
  title?: ReactNode;
  /** Right-aligned header element (e.g. close button override). */
  meta?: ReactNode;
  /** Width of the panel. `sm` ≈ 24rem, `md` ≈ 28rem, `lg` ≈ 32rem. */
  size?: 'sm' | 'md' | 'lg';
  /** Body content. */
  children: ReactNode;
  /** Optional footer pinned to the bottom of the panel. */
  footer?: ReactNode;
  /** When false, clicking the backdrop / pressing Escape won't close. */
  dismissable?: boolean;
  className?: string;
}

const SIZE: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export function Modal({
  open,
  onClose,
  title,
  meta,
  size = 'md',
  children,
  footer,
  dismissable = true,
  className,
}: ModalProps) {
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
      lastFocusedRef.current?.focus?.();
    };
  }, [open]);

  // Escape closes the panel.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, dismissable]);

  // Move focus into the panel when it opens.
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
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6"
      role="presentation"
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        onClick={handleBackdropClick}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] animate-fade-in"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Dialog'}
        className={cn(
          'relative w-full bg-white rounded-2xl shadow-2xl border border-slate-100',
          'flex flex-col max-h-[90vh] overflow-hidden',
          'animate-modal-scale-in',
          SIZE[size],
          className,
        )}
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-3 px-6 pt-5 pb-3 shrink-0">
          <div className="flex-1 min-w-0">
            {title && (
              typeof title === 'string'
                ? <h2 className="text-lg font-semibold text-slate-900 truncate">{title}</h2>
                : <div className="text-lg font-semibold text-slate-900">{title}</div>
            )}
            {meta && (
              <p className="mt-1 text-sm text-slate-500">{meta}</p>
            )}
          </div>
          {dismissable && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={cn(
                'shrink-0 -mr-1 -mt-1 inline-flex items-center justify-center h-9 w-9 rounded-lg',
                'text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#002b5b] focus-visible:ring-offset-2',
              )}
            >
              <X size={18} aria-hidden />
            </button>
          )}
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <footer className="border-t border-slate-100 px-6 py-4 shrink-0 bg-slate-50">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
