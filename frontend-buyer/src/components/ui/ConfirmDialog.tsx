import { type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { cn } from '@/lib/cn';

/* ──────────────────────────────────────────────────────────────────────────
 * ConfirmDialog — small wrapper around `<Modal>` for yes/no decisions.
 *
 * Why a wrapper instead of using `<Modal>` directly at every call site:
 *
 *   • Two-button layouts (Cancel + Confirm) keep drifting across the
 *     codebase — confirm labels get longer on one screen and shorter on
 *     another, the danger button becomes blue elsewhere, the loading
 *     spinner ends up on the wrong button. Centralising the pattern
 *     means destructive flows stay visually and behaviourally
 *     consistent.
 *   • Destructive flows have a few extra rules worth owning in one
 *     place: button order (Cancel left, action right, matching the
 *     OS-level "Cancel is the default"), loading state that locks the
 *     panel (no double-submits, no Escape dismissal mid-flight), and
 *     `autoFocus` on the Cancel button so a stray Enter press does
 *     not destroy data.
 *
 * Non-destructive variants pass `tone="info"` and pick a different
 * confirm label / variant — same plumbing, different copy + colour.
 * ──────────────────────────────────────────────────────────────────────── */

export type ConfirmDialogTone = 'danger' | 'warning' | 'info';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /**
   * Title rendered in the modal header. Kept short — confirmation
   * dialogs work best when the question itself is the headline.
   */
  title: ReactNode;
  /**
   * Body copy. Plain string or richer ReactNode if a call site needs
   * to highlight a product name etc.
   */
  description?: ReactNode;
  /** Label for the cancel button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Label for the confirm button. Defaults to "Confirm". */
  confirmLabel?: string;
  /**
   * Visual tone of the confirm button. `danger` is the default and is
   * the right choice for destructive flows (remove, delete, sign out).
   */
  tone?: ConfirmDialogTone;
  /**
   * While the parent is awaiting the confirm action (e.g. an in-flight
   * API call) pass `true` to lock the panel and show a spinner on the
   * confirm button. Escape / backdrop dismissal are also disabled so
   * the user can't race the network.
   */
  isLoading?: boolean;
  /** Called when the user explicitly clicks the confirm button. */
  onConfirm: () => void;
}

const TONE_BUTTON: Record<ConfirmDialogTone, 'danger' | 'primary'> = {
  danger: 'danger',
  warning: 'danger',
  info: 'primary',
};

const TONE_ICON: Record<ConfirmDialogTone, string> = {
  danger: 'bg-danger-50 text-danger-600',
  warning: 'bg-amber-50 text-amber-600',
  info: 'bg-brand-50 text-[#002b5b]',
};

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  tone = 'danger',
  isLoading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      /*
        While loading, force `dismissable=false` so a stray Escape or
        backdrop click can't cancel the request mid-flight. We can't
        pass `dismissable={!isLoading}` directly because Modal expects
        a stable boolean — passing it conditionally each render is
        fine, the consumer just sees a temporarily locked dialog.
      */
      dismissable={!isLoading}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          {/*
            Cancel is `type="button"` (Modal already wraps in a form-less
            shell, but explicit is cheap) and gets `autoFocus` so an
            accidental Enter doesn't fire the destructive action. The
            confirm button takes over focus once the API call starts.
          */}
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
            autoFocus={!isLoading}
            className="sm:w-auto"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={TONE_BUTTON[tone]}
            onClick={onConfirm}
            isLoading={isLoading}
            leftIcon={
              tone !== 'info' ? (
                <AlertTriangle size={16} aria-hidden />
              ) : undefined
            }
            className="sm:w-auto"
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex gap-4">
        {/*
          Icon disc — visual cue for the tone before the user reads any
          copy. Sits in the body so the header stays a clean h2.
        */}
        <div
          aria-hidden
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            TONE_ICON[tone],
          )}
        >
          <AlertTriangle size={20} />
        </div>
        <div className="min-w-0 flex-1 pt-1">
          {typeof description === 'string' ? (
            <p className="text-sm leading-relaxed text-slate-600">
              {description}
            </p>
          ) : (
            description
          )}
        </div>
      </div>
    </Modal>
  );
}
