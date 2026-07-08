import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, Loader2 } from 'lucide-react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
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
  // null = user hasn't touched it; render `value` directly.
  // Once they touch anything, keep a local draft until a successful
  // commit aligns it back with the upstream value.
  const [draft, setDraft] = useState<number | null>(null);
  const display = draft ?? value;

  const debounced = useDebouncedValue(display, 400);

  // Keep the latest `onCommit` in a ref so we don't depend on its identity
  // inside the commit effect (avoiding the "refs during render" rule).
  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  useEffect(() => {
    if (debounced === value) return;
    if (!Number.isFinite(debounced)) return;
    const next = Math.min(max, Math.max(1, Math.trunc(debounced)));
    if (next === value) return;
    onCommitRef.current(next);
  }, [debounced, value, max]);

  const dec = () => {
    if (display <= 1) return;
    const next = display - 1;
    setDraft(next);
    void Promise.resolve(onCommit(next)).catch(() => {
      setDraft(null);
      onCommitError();
    });
  };

  const inc = () => {
    if (display >= max) return;
    const next = Math.min(display + 1, max);
    setDraft(next);
    void Promise.resolve(onCommit(next)).catch(() => {
      setDraft(null);
      onCommitError();
    });
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
        className="h-8 w-8 inline-flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white"
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
        onChange={(e) => {
          const parsed = Number(e.target.value);
          setDraft(Number.isFinite(parsed) ? parsed : null);
        }}
        onBlur={() => {
          if (display < 1 || display > max) {
            const next = Math.min(max, Math.max(1, Math.trunc(display)));
            setDraft(next);
            onCommit(next);
          }
        }}
        aria-label="Quantity"
        className="h-8 w-12 text-center text-sm font-medium text-slate-900 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-[#002b5b]/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />

      <button
        type="button"
        onClick={inc}
        aria-label="Increase quantity"
        disabled={disabled || display >= max}
        className="h-8 w-8 inline-flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white"
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
