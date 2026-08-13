import { useCallback, useEffect, useRef, useState } from 'react';
import { Minus, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface QuantityStepperProps {
  value: number;
  /** Upper bound — '+' button disables at this limit. Defaults to 100. */
  max?: number;
  /** Disabled state — greyed out, unclickable. */
  disabled?: boolean;
  /** Show a spinner overlay while a commit is in-flight. */
  isPending?: boolean;
  /**
   * Commits a new quantity to the server. May return void or `Promise<void>`.
   * On rejection `onCommitError` is called.
   */
  onCommit: (next: number) => Promise<void> | void;
  /** Called when `onCommit` rejects — lets the parent reset the local draft. */
  onCommitError: () => void;
  /** Applied to the outermost wrapper div. */
  className?: string;
}

/**
 * QuantityStepper — small +/- control with a controlled numeric input.
 *
 * The numeric input is "controlled but not committed" — the user types,
 * the row updates visually, but the upstream API is only fired after a
 * debounce delay or a single click on + / -.
 *
 * `max` enforces a hard stock limit on the UI: the '+' button is disabled
 * and the input clamps at `max` so no API call can ever exceed available stock.
 *
 * ── Architecture ────────────────────────────────────────────────────────────
 *
 * API calls are triggered ONLY from event handlers (click, blur), never from
 * a `useEffect`. This eliminates the feedback loop that caused the cart
 * quantity to oscillate after the EditCartItemModal updated the backend:
 *
 *   Modal closes → cart refetches → `value` prop changes → stale useEffect
 *   fires a pending debounced call with the OLD `onCommit` identity → wrong
 *   API payload → cart refetches again → loop.
 *
 * The prop-sync effect (resetting `draft` when `value` changes) is safe
 * because nothing listens to `draft` to trigger `onCommit` — `draft` only
 * controls the visual display.
 */
export function QuantityStepper({
  value,
  max = 100,
  disabled,
  isPending,
  onCommit,
  onCommitError,
  className,
}: QuantityStepperProps) {
  // `draft` is the local "uncommitted" state while the user is interacting.
  // `null` means the user has not touched it; `value` (the prop) is displayed.
  const [draft, setDraft] = useState<number | null>(null);
  const display = draft ?? value;

  // Keep the latest `onCommit` in a ref so debounced closures always call the
  // current version without needing it as a dependency.
  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  // Stable debounce timer. Resetting it cancels any pending call, so only
  // the LAST interaction within the 400 ms window fires the API.
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wraps `onCommit` with debounce + error handling. The function itself is
  // stable (no reactive deps), so `useCallback` gives us a stable identity
  // regardless of when the parent re-renders.
  const scheduleCommit = useCallback(
    (next: number) => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        void Promise.resolve(onCommitRef.current(next)).catch(() => {
          setDraft(null);
          onCommitError();
        });
      }, 400);
    },
    // Empty deps: `onCommitRef` and `onCommitError` are always current at call
    // time (refs are read, not depended on), so this function's identity is
    // stable and the debounce timer is reset ONLY by user interactions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Cleanup: cancel any pending debounce when the component unmounts.
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, []);

  /*
   * Safe prop sync — reset draft when the external `value` changes.
   *
   * This effect is safe because it ONLY writes to `draft`. There is no effect
   * listening to `draft` to trigger `onCommit`, so syncing the prop to local
   * state can never cause an accidental API call.
   */
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setDraft(null); }, [value]);

  const dec = () => {
    if (disabled || display <= 1) return;
    const next = display - 1;
    setDraft(next);
    scheduleCommit(next);
  };

  const inc = () => {
    if (disabled || display >= max) return;
    const next = Math.min(display + 1, max);
    setDraft(next);
    scheduleCommit(next);
  };

  const handleBlur = () => {
    if (display < 1 || display > max) {
      const next = Math.min(max, Math.max(1, Math.trunc(display)));
      setDraft(next);
      scheduleCommit(next);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = Number(e.target.value);
    setDraft(Number.isFinite(parsed) ? parsed : null);
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden',
        disabled && 'opacity-50 pointer-events-none',
        isPending && 'animate-pulse',
        className,
      )}
    >
      <button
        type="button"
        onClick={dec}
        aria-label="Decrease quantity"
        disabled={disabled || display <= 1}
        className="h-8 w-8 inline-flex items-center justify-center text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
      >
        <Minus size={14} aria-hidden />
      </button>

      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        value={display}
        disabled={disabled}
        onChange={handleChange}
        onBlur={handleBlur}
        aria-label="Quantity"
        className="h-8 w-12 text-center text-sm font-medium text-slate-900 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-[#002b5b]/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />

      <button
        type="button"
        onClick={inc}
        aria-label="Increase quantity"
        disabled={disabled || display >= max}
        className="h-8 w-8 inline-flex items-center justify-center text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
      >
        <Plus size={14} aria-hidden />
      </button>

      {isPending && (
        <span className="pr-2">
          <Loader2 size={12} className="animate-spin text-slate-400" aria-hidden />
        </span>
      )}
    </div>
  );
}
