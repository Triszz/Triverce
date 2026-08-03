import { useMemo } from 'react';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { buildAttributeAxes, type AttributeAxis } from './variantUtils';
import { STOCK_LABEL, STOCK_TONE } from './stockStatus';
import type {
  ProductVariant,
  StockStatus,
  VariantAttribute,
} from '@/services/productService';

/* ──────────────────────────────────────────────────────────────────────────
 * Stock-status helpers
 * ──────────────────────────────────────────────────────────────────────── */

export const StockBadge = ({
  status,
  className,
}: {
  status: StockStatus;
  className?: string;
}) => (
  <Badge tone={STOCK_TONE[status]} size="md" className={className}>
    {STOCK_LABEL[status]}
  </Badge>
);

/* ──────────────────────────────────────────────────────────────────────────
 * Attribute axis (one row of swatches/pills per attribute name)
 * ──────────────────────────────────────────────────────────────────────── */

/* ──────────────────────────────────────────────────────────────────────────
 * VariantPicker
 * ──────────────────────────────────────────────────────────────────────── */

export interface VariantPickerProps {
  variants: ProductVariant[];
  /**
   * The user's *partial* selection — `{ axisName: value, ... }`.
   *
   * The dictionary may be empty (page just loaded, nothing picked yet),
   * partially populated (user clicked some axes), or fully populated
   * (every axis has a value, the parent page can resolve a variant).
   * The picker does not enforce completion — it just renders the
   * chips, derives per-chip availability against this map, and emits
   * `(axis, value)` to the parent when a chip is clicked.
   */
  selectedOptions: Record<string, string>;
  /**
   * Fired when the user clicks a chip. Receives the axis name + the
   * value the user clicked. The picker does NOT resolve a variant ID —
   * variant resolution is the parent's job (the page derives
   * `selectedVariant` from `selectedOptions` once all axes are picked).
   *
   * Chips that would resolve to an out-of-stock combination are
   * rendered with the native `disabled` attribute on their `<button>`,
   * so the browser blocks their click events entirely and this
   * callback is never invoked for them. The user must toggle off
   * their existing selection before picking a conflicting value.
   */
  onOptionSelect: (axis: string, value: string) => void;
  className?: string;
}

/**
 * Render a clean row of attribute selectors (one per attribute name).
 *
 * Behaviour:
 *   • For attributes named "Color", render a colored circle swatch.
 *   • For everything else (Size, Storage, etc.), render a text pill.
 *   • Each chip's clickability is computed dynamically: a chip is
 *     disabled iff no in-stock variant exists for the hypothetical
 *     combination (`{ ...selectedOptions, [axis]: value }`).
 *   • The currently selected chip on each axis is pre-highlighted.
 */
export function VariantPicker({
  variants,
  selectedOptions,
  onOptionSelect,
  className,
}: VariantPickerProps) {
  const axes = useMemo(() => buildAttributeAxes(variants), [variants]);

  // Map: variantId → Map<attributeName, attributeValue>. Used by the
  // availability scan below to do O(1) per-axis lookups per variant.
  const variantsByAttr = useMemo(() => {
    return new Map(
      variants.map((v) => [
        v.id,
        new Map(v.attributes.map((a) => [a.attributeName, a.value])),
      ]),
    );
  }, [variants]);

  // The picker receives partial selections directly from the parent.
  // We turn the dict into a Map for O(1) per-axis lookups in the JSX
  // and the availability scan. When `selectedOptions` is `{}` the map
  // is empty — which is exactly the "page just loaded" state.
  const selectedAttrs = useMemo(
    () => new Map(Object.entries(selectedOptions)),
    [selectedOptions],
  );

  /* ─── Dynamic cross-axis availability ──────────────────────────────── */

  /**
   * Treat a variant as having purchasable inventory when it is active
   * AND has stock left. The backend exposes inventory in two ways:
   *  - `stockStatus`: a tri-state ('in_stock' | 'low_stock' | 'out_of_stock')
   *    computed by the backend from the actual stock levels.
   *  - `available` (optional): the raw count of sellable units after
   *    reservations are subtracted. Older payloads may omit it.
   * Both signals are AND-ed together for the strictest reading; when
   * `available` is undefined we trust the backend-computed `stockStatus`.
   */
  const hasStock = (v: ProductVariant): boolean => {
    if (!v.isActive) return false;
    if (v.stockStatus === 'out_of_stock') return false;
    if (v.available !== undefined && v.available <= 0) return false;
    return true;
  };

  /**
   * Given an axis + a candidate value on that axis, is there at least
   * one in-stock variant that would satisfy the resulting hypothetical
   * combination?
   *
   * Algorithm (the "gold standard" e-commerce cross-axis availability):
   *   1. Take the user's current `selectedOptions` (e.g. { Color: 'White' }).
   *   2. Build `hypothetical = { ...selectedOptions, [axis]: value }`
   *      (e.g. { Color: 'White', Size: 'S' }).
   *   3. Search the variants array for any variant whose attributes
   *      match ALL keys in `hypothetical` AND `hasStock(variant) === true`.
   *   4. If any match exists → `available = true` (chip is clickable).
   *      Otherwise → `available = false` (chip is disabled + struck through).
   *
   * Crucially this works correctly with *partial* selections — if
   * `selectedOptions` is empty, the hypothetical only contains the
   * candidate axis/value, so availability reduces to "does any in-stock
   * variant carry this value?" across the whole catalogue. That's the
   * intended behaviour for a freshly-loaded product page where the
   * user hasn't picked anything yet.
   *
   * Edge case — currently selected chip: the algorithm naturally keeps
   * the selected chip `available = true` because the selected variant
   * itself matches the hypothetical. The JSX additionally relaxes the
   * `disabled` flag on the selected chip so a user can never be trapped
   * on an OOS-only selection by re-clicking it.
   */
  const isValueAvailable = (
    axisName: string,
    value: string,
  ): boolean => {
    const hypothetical: Record<string, string> = {
      ...selectedOptions,
      [axisName]: value,
    };
    for (const v of variants) {
      if (!hasStock(v)) continue;
      const attrs = variantsByAttr.get(v.id);
      if (!attrs) continue;
      let matches = true;
      for (const [name, wanted] of Object.entries(hypothetical)) {
        if (attrs.get(name) !== wanted) {
          matches = false;
          break;
        }
      }
      if (matches) return true;
    }
    return false;
  };

  // Pre-compute a per-axis map of `value → availability` so the JSX
  // doesn't re-run the search inside the render loop. Cheap O(axes ×
  // values × variants) once per derived-data change.
  const availabilityByAxis = useMemo(() => {
    const map = new Map<string, Map<string, boolean>>();
    for (const axis of axes) {
      const inner = new Map<string, boolean>();
      for (const value of axis.values) {
        inner.set(value, isValueAvailable(axis.name, value));
      }
      map.set(axis.name, inner);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [axes, variants, selectedOptions]);

  // The picker is now purely a view + click emitter — it does NOT
  // resolve a variant ID on click. The parent page derives the full
  // variant from `selectedOptions` once every axis has been picked.
  const handlePillClick = (axisName: string, value: string) => {
    onOptionSelect(axisName, value);
  };

  if (axes.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-5', className)}>
      {axes.map((axis) => {
        const selectedValue = selectedAttrs.get(axis.name);
        const isColorAxis = axis.name.toLowerCase() === 'color';

        return (
          <div key={axis.name}>
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-sm font-medium text-slate-700">
                {axis.name}
                {selectedValue && (
                  <span className="ml-2 text-slate-500 font-normal">
                    {selectedValue}
                  </span>
                )}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {axis.values.map((value) => {
                const isSelected = selectedValue === value;
                // Dynamic cross-axis availability — driven by the
                // hypothetical-match algorithm below. `available` is true
                // iff SOME in-stock variant carries the full
                // hypothetical attribute set. Anything else is rendered
                // as a disabled, struck-through chip.
                const available =
                  availabilityByAxis.get(axis.name)?.get(value) ?? false;
                // We never disable the currently-selected chip (even if
                // it's OOS) — disabling it would trap the user on a
                // state they can't escape from by re-clicking it to
                // toggle off. Every other unavailable chip is fully
                // disabled so the browser natively blocks clicks.
                const isDisabled = !isSelected && !available;
                // Belt-and-suspenders: even with `disabled` on the button
                // the click handler should no-op on unavailable chips, in
                // case the button props change in future refactors.
                const guardedClick = () => {
                  if (isDisabled) return;
                  handlePillClick(axis.name, value);
                };

                if (isColorAxis) {
                  return (
                    <ColorSwatch
                      key={value}
                      value={value}
                      selected={isSelected}
                      available={available}
                      disabled={isDisabled}
                      onClick={guardedClick}
                    />
                  );
                }

                return (
                  <Pill
                    key={value}
                    selected={isSelected}
                    available={available}
                    disabled={isDisabled}
                    onClick={guardedClick}
                  >
                    {value}
                  </Pill>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Pill / Swatch primitives (kept local — no other UI uses these yet)
 * ──────────────────────────────────────────────────────────────────────── */

function Pill({
  selected,
  available,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  available: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      aria-label={
        !available ? `${children} (unavailable)` : undefined
      }
      disabled={disabled}
      onClick={onClick}
      className={cn(
        // Layout. `relative overflow-hidden` so the red-X overlay (a
        // child absolutely-positioned over the chip) is clipped to the
        // rounded boundary and the rotating lines don't bleed outside
        // the chip's box.
        'relative overflow-hidden min-w-[3rem] rounded-lg border px-4 py-2 text-sm font-medium',
        'transition-all duration-150',
        // Cursor states.
        !disabled && 'cursor-pointer',
        disabled && 'cursor-not-allowed',
        // Selected (always enabled — see `isDisabled = !isSelected &&
        // !available` upstream, which forces `disabled=false` when
        // `selected=true`). Solid dark navy with white text. NO hover
        // background override: previously the generic `hover:bg-slate-50`
        // rule was firing on selected chips too, painting the dark
        // navy background slate-50 on hover and making the white text
        // invisible. Hovering now only nudges the border/bg slightly
        // (90% opacity) for a tactile feel.
        selected && 'border-[#002b5b] bg-[#002b5b] text-white shadow-sm hover:border-[#002b5b]/80 hover:bg-[#002b5b]/90',
        // Unselected + enabled → white bg + slate text, navy accent
        // on hover. This is the standard interactive pill state.
        !selected && !disabled && 'border-slate-200 bg-white text-slate-700 hover:border-[#002b5b] hover:text-[#002b5b]',
        // Unselected + disabled → dimmed default. The red X overlay
        // (rendered below) is the primary unavailability cue;
        // `opacity-60` simply lightens the chip so the X stands out.
        !selected && disabled && 'border-slate-200 bg-white text-slate-400 opacity-60',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#002b5b] focus-visible:ring-offset-2',
      )}
    >
      <span className="relative">{children}</span>
      {disabled && !selected && (
        // Bold red "X" overlay for unavailable, non-selected chips.
        // Two diagonal 1.5px lines rotated ±45°, each 150% wide so the
        // rotated bars fully cross the chip's bounding box. The
        // overlay sits above the text but is `pointer-events-none` so
        // it never intercepts the parent's click — defence-in-depth
        // alongside the native `disabled` attribute.
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span className="absolute w-[150%] h-[1.5px] bg-red-500 rotate-45" />
          <span className="absolute w-[150%] h-[1.5px] bg-red-500 -rotate-45" />
        </span>
      )}
    </button>
  );
}

function ColorSwatch({
  value,
  selected,
  available,
  disabled,
  onClick,
}: {
  value: string;
  selected: boolean;
  available: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  // Map common color names to actual hex values. Falls back to slate grey
  // for unknown names — never crashes, just looks plain.
  const swatchColor = colorFromName(value);
  const unavailable = !available;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      aria-label={
        unavailable ? `${value} (unavailable)` : value
      }
      title={unavailable ? `${value} — unavailable` : value}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        // Layout. `relative overflow-hidden` clips the rotated red-X
        // overlay to the rounded-full boundary so the diagonal lines
        // don't bleed past the swatch's circle.
        'group relative h-10 w-10 rounded-full overflow-hidden',
        'transition-all duration-150',
        !disabled &&
          'cursor-pointer hover:ring-slate-300',
        disabled && 'cursor-not-allowed',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#002b5b] focus-visible:ring-offset-2',
        selected && available && 'ring-2 ring-offset-2 ring-[#002b5b]',
        selected && !available && 'ring-2 ring-offset-2 ring-[#002b5b]/40',
        !selected && available && 'ring-1 ring-slate-200',
        // Unavailable + unselected → dimmed fill + dashed inner ring
        // so the colour chip itself still reads as the named colour
        // (helpful for users with red-green colour-vision deficiency
        // who rely on the dashed border cue), but with reduced
        // opacity to communicate "not currently pickable".
        unavailable && !selected && 'opacity-60',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute inset-1 rounded-full border border-slate-200/60',
          unavailable && 'border-dashed',
        )}
        style={{ backgroundColor: swatchColor }}
      />
      {selected && available && (
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center text-white"
        >
          <Check size={16} strokeWidth={3} />
        </span>
      )}
      {disabled && !selected && (
        // Bold red "X" overlay for unavailable, non-selected swatches.
        // Two diagonal 1.5px lines rotated ±45°, each 150% wide so the
        // rotated bars fully cross the swatch's bounding box. The
        // overlay is `pointer-events-none` so it never intercepts the
        // parent's click — defence-in-depth alongside the native
        // `disabled` attribute on the button.
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span className="absolute w-[150%] h-[1.5px] bg-red-500 rotate-45" />
          <span className="absolute w-[150%] h-[1.5px] bg-red-500 -rotate-45" />
        </span>
      )}
    </button>
  );
}

/**
 * Best-effort color name → hex lookup. Unknown names render as slate.
 * Returns ONLY inline CSS so we never break SSR / CSP with className spam.
 */
function colorFromName(name: string): string {
  const normalized = name.trim().toLowerCase();
  const map: Record<string, string> = {
    black: '#0f172a',
    white: '#f8fafc',
    pearl: '#f5f5f4',
    ivory: '#fffff0',
    red: '#dc2626',
    blue: '#2563eb',
    navy: '#1e3a8a',
    'midnight navy': '#1e293b',
    green: '#16a34a',
    olive: '#65735a',
    sand: '#d4b896',
    tan: '#c9a982',
    silver: '#c0c0c0',
    graphite: '#475569',
    onyx: '#0a0a0a',
    cognac: '#9a463d',
    'matte black': '#1c1917',
  };
  return map[normalized] ?? '#94a3b8';
}

/* Export attribute shapes so consumers can build their own pickers later. */
export type { AttributeAxis, VariantAttribute };