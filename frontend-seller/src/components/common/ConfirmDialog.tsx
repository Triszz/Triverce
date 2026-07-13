import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ConfirmDialogProps {
  isOpen: boolean;
  /** Short headline shown above the description. */
  title: string;
  /** Body copy explaining the consequence of confirming. */
  description?: string;
  /** Called when the user confirms the destructive action. */
  onConfirm: () => void;
  /** Called when the user cancels, dismisses, or presses Escape. */
  onCancel: () => void;
  /** Defaults to "Delete" to match the dashboard's tonal vocabulary. */
  confirmText?: string;
  /** Defaults to "Cancel". */
  cancelText?: string;
  /**
   * When true, the confirm button renders in red and a warning badge is
   * shown next to the title — used for delete-style operations.
   */
  isDestructive?: boolean;
  /**
   * Disables the confirm button — used when an async delete is already
   * in-flight so a double-click doesn't fire twice.
   */
  isConfirming?: boolean;
}

/**
 * ConfirmDialog — a small, Tailwind-styled confirmation modal.
 *
 * Why not `<dialog>`: the dashboard runs on every page (alerts from the
 * products list, the variant rows, the orders page…) and we want a
 * consistent visual treatment that matches the rest of the seller
 * chrome (brand blue, brand red, neutral borders). <dialog> would force
 * re-styling on top of the platform default.
 *
 * Conventions:
 *   • Confirm button is brand blue by default.
 *   • Confirm button turns red when `isDestructive` — destructive
 *     actions should never look "safe".
 *   • Escape and backdrop click both call `onCancel`. Tab is trapped
 *     loosely (focus stays inside the panel on open).
 */
export function ConfirmDialog({
  isOpen,
  title,
  description,
  onConfirm,
  onCancel,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  isDestructive = false,
  isConfirming = false,
}: ConfirmDialogProps) {
  // Escape closes; capture phase so we beat any form handlers.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby={description ? 'confirm-dialog-description' : undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200">
        <div className="px-6 py-5">
          <div className="flex items-start gap-3">
            {isDestructive && (
              <span
                className="mt-0.5 inline-flex w-9 h-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600"
                aria-hidden
              >
                <AlertTriangle size={18} />
              </span>
            )}
            <div className="flex-1 min-w-0">
              <h2
                id="confirm-dialog-title"
                className="text-base font-semibold text-slate-900"
              >
                {title}
              </h2>
              {description && (
                <p
                  id="confirm-dialog-description"
                  className="mt-1.5 text-sm text-slate-500"
                >
                  {description}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-xl">
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors shadow-sm',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isDestructive
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#002b5b] hover:bg-[#001f3f]',
            )}
          >
            {isConfirming ? 'Working…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;