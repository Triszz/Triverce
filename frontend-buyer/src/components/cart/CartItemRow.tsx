import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { PriceTag } from '@/components/ui/PriceTag';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/hooks/useCart';
import type { CartItemPublic } from '@/services/cartService';
import { cn } from '@/lib/cn';

/* ──────────────────────────────────────────────────────────────────────────
 * Quantity stepper — small +/- control with a numeric input.
 * The numeric input is "controlled but not committed" — the user types,
 * the row updates visually, but the upstream API is only fired after the
 * user stops typing (or after a single click on + / -).
 * ──────────────────────────────────────────────────────────────────────── */

function QuantityStepper({
  value,
  disabled,
  onCommit,
  isPending,
}: {
  value: number;
  disabled?: boolean;
  onCommit: (next: number) => Promise<void> | void;
  isPending?: boolean;
}) {
  // null = the user hasn't touched it; render `value` directly.
  // Once they touch anything, we keep a local draft until a successful
  // commit aligns it back with the upstream value.
  const [draft, setDraft] = useState<number | null>(null);
  const display = draft ?? value;

  // Debounce so we don't spam the cart API per keystroke.
  const debounced = useDebouncedValue(display, 400);

  // Keep the latest `onCommit` in a ref so we don't depend on its
  // identity inside the commit effect. Updated inside an effect so the
  // "refs during render" rule isn't violated.
  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  useEffect(() => {
    if (debounced === value) return;            // already committed
    if (!Number.isFinite(debounced)) return;    // ignore NaN
    const next = Math.min(100, Math.max(1, Math.trunc(debounced)));
    if (next === value) return;
    onCommitRef.current(next);
  }, [debounced, value]);

  const dec = () => {
    if (display <= 1) return;
    const next = display - 1;
    setDraft(next);
    onCommit(next);
  };

  const inc = () => {
    if (display >= 100) return;
    const next = display + 1;
    setDraft(next);
    onCommit(next);
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden',
        disabled && 'opacity-50 pointer-events-none',
        isPending && 'animate-pulse',
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
        max={100}
        value={display}
        disabled={disabled}
        onChange={(e) => {
          const parsed = Number(e.target.value);
          setDraft(Number.isFinite(parsed) ? parsed : null);
        }}
        onBlur={() => {
          // If the user types something out of range, snap it to bounds
          // and commit by clearing the local draft so the parent wins.
          if (display < 1 || display > 100) {
            const next = Math.min(100, Math.max(1, Math.trunc(display)));
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
        disabled={disabled || display >= 100}
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

/* ──────────────────────────────────────────────────────────────────────────
 * CartItemRow
 * ──────────────────────────────────────────────────────────────────────── */

export interface CartItemRowProps {
  item: CartItemPublic;
  /** When true, render a more compact layout suitable for the side-drawer. */
  compact?: boolean;
  /**
   * Fired when the user clicks an in-row navigation link (e.g. the
   * product name). The Cart Drawer passes its `close` so the slide-over
   * doesn't obscure the destination page after navigation.
   */
  onNavigate?: () => void;
  className?: string;
}

/**
 * CartItemRow — single line item used by both the slide-over drawer and
 * the full-page cart. Renders:
 *   • Thumbnail (linked to product detail if a slug is known)
 *   • Product name + variant SKU
 *   • Quantity stepper (debounced)
 *   • Subtotal (price × qty)
 *   • Remove button (uses optimistic remove from useCart)
 */
export function CartItemRow({
  item,
  compact = false,
  onNavigate,
  className,
}: CartItemRowProps) {
  const { updateItem, removeItem, isUpdating, isRemoving } = useCart();

  const handleCommit = useMemo(
    () => async (next: number) => {
      try {
        await updateItem(item.id, { quantity: next });
      } catch {
        // Hook already toasted — swallow here so the stepper stays calm.
      }
    },
    [updateItem, item.id],
  );

  const handleRemove = async () => {
    try {
      await removeItem(item.id);
      toast.success(`Removed "${item.productName ?? 'item'}" from cart`);
    } catch {
      // Hook already toasted.
    }
  };

  const productHref = item.productSlug ? `/product/${item.productSlug}` : null;
  const unitPrice = item.price ?? 0;

  return (
    <li
      className={cn(
        'flex gap-3 sm:gap-4 py-4 border-b border-slate-100 last:border-b-0',
        className,
      )}
    >
      {/* Thumbnail */}
      <div
        className={cn(
          'shrink-0 rounded-lg overflow-hidden bg-slate-50 border border-slate-100',
          compact ? 'h-16 w-16' : 'h-20 w-20 sm:h-24 sm:w-24',
        )}
      >
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.productName ?? 'Product image'}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-slate-300 text-lg font-semibold">
            {(item.productName ?? '?').charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Middle column */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {productHref ? (
              <Link
                to={productHref}
                onClick={onNavigate}
                className="block text-sm font-medium text-slate-900 hover:text-[#002b5b] line-clamp-2 transition-colors"
              >
                {item.productName ?? 'Product'}
              </Link>
            ) : (
              <p className="text-sm font-medium text-slate-900 line-clamp-2">
                {item.productName ?? 'Product'}
              </p>
            )}
            {item.sku && (
              <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                {item.sku}
              </p>
            )}
          </div>

          {!compact && (
            <PriceTag value={unitPrice} size="sm" className="shrink-0" />
          )}
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <QuantityStepper
            value={item.quantity}
            onCommit={handleCommit}
            isPending={isUpdating}
          />

          <PriceTag
            value={item.subtotal}
            size={compact ? 'sm' : 'md'}
            className="font-semibold"
          />
        </div>
      </div>

      {/* Remove (top-right) */}
      <div className="shrink-0 self-start">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRemove}
          disabled={isRemoving}
          aria-label={`Remove ${item.productName ?? 'item'}`}
          className="text-slate-400 hover:text-danger-600 hover:bg-danger-50 -mr-2 -mt-1"
        >
          {isRemoving ? (
            <Loader2 size={14} className="animate-spin" aria-hidden />
          ) : (
            <Trash2 size={14} aria-hidden />
          )}
        </Button>
      </div>
    </li>
  );
}
