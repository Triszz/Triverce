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
  /** Currently selected variant. */
  selectedId: string | null;
  onSelect: (variantId: string) => void;
  className?: string;
}

/**
 * Render a clean row of attribute selectors (one per attribute name).
 *
 * Behaviour:
 *   • For attributes named "Color", render a colored circle swatch.
 *   • For everything else (Size, Storage, etc.), render a text pill.
 *   • A pill is **disabled** when no active variant carries that value.
 *   • The currently selected variant's values are pre-highlighted.
 */
export function VariantPicker({
  variants,
  selectedId,
  onSelect,
  className,
}: VariantPickerProps) {
  const axes = useMemo(() => buildAttributeAxes(variants), [variants]);

  // Map: variantId → Map<attributeName, attributeValue>.
  const variantsByAttr = useMemo(() => {
    return new Map(
      variants.map((v) => [
        v.id,
        new Map(v.attributes.map((a) => [a.attributeName, a.value])),
      ]),
    );
  }, [variants]);

  const selectedVariant =
    variants.find((v) => v.id === selectedId) ?? variants[0] ?? null;

  const currentSelections: Record<string, string | undefined> = {};
  if (selectedVariant) {
    for (const a of selectedVariant.attributes) {
      currentSelections[a.attributeName] = a.value;
    }
  }

  /**
   * For an attribute row + candidate value: which variant would the user
   * land on if they picked that value, given everything else they've
   * already chosen?
   *
   * Returns the variant regardless of stock so out-of-stock chips remain
   * clickable (e-commerce convention — users should still be able to view
   * the variant's image). The caller is responsible for any "is in stock"
   * styling cues.
   */
  const findVariantForAxis = (
    axisName: string,
    candidateValue: string,
  ): ProductVariant | null => {
    for (const v of variants) {
      const attrs = variantsByAttr.get(v.id);
      if (!attrs) continue;
      if (attrs.get(axisName) !== candidateValue) continue;
      // For all OTHER axes, the value must match what the user has already picked.
      let match = true;
      for (const [otherName, otherValue] of Object.entries(currentSelections)) {
        if (otherName === axisName) continue;
        if (otherValue === undefined) continue;
        if (attrs.get(otherName) !== otherValue) {
          match = false;
          break;
        }
      }
      if (match) return v;
    }
    return null;
  };

  const handlePillClick = (axisName: string, value: string) => {
    const v = findVariantForAxis(axisName, value);
    if (!v) return;
    onSelect(v.id);
  };

  if (axes.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-5', className)}>
      {axes.map((axis) => {
        const selectedValue = currentSelections[axis.name];
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
                const variant = findVariantForAxis(axis.name, value);
                // Out-of-stock chips stay clickable so buyers can view the
                // variant's image, but get visual cues to signal unavailability.
                const isOutOfStock =
                  !!variant &&
                  (variant.stockStatus === 'out_of_stock' || !variant.isActive);

                if (isColorAxis) {
                  return (
                    <ColorSwatch
                      key={value}
                      value={value}
                      selected={isSelected}
                      outOfStock={isOutOfStock}
                      onClick={() => handlePillClick(axis.name, value)}
                    />
                  );
                }

                return (
                  <Pill
                    key={value}
                    selected={isSelected}
                    outOfStock={isOutOfStock}
                    onClick={() => handlePillClick(axis.name, value)}
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
  outOfStock,
  onClick,
  children,
}: {
  selected: boolean;
  outOfStock: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={outOfStock ? `${children} (out of stock)` : undefined}
      onClick={onClick}
      className={cn(
        'relative min-w-[3rem] rounded-lg border px-4 py-2 text-sm font-medium',
        'transition-all duration-150',
        'cursor-pointer',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#002b5b] focus-visible:ring-offset-2',
        selected
          ? 'border-[#002b5b] bg-[#002b5b] text-white shadow-sm'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
        outOfStock && !selected && 'opacity-50',
        outOfStock &&
          selected &&
          'border-[#002b5b]/60 bg-[#002b5b]/70 text-white shadow-sm',
      )}
    >
      <span className={cn(outOfStock && 'line-through decoration-2')}>
        {children}
      </span>
    </button>
  );
}

function ColorSwatch({
  value,
  selected,
  outOfStock,
  onClick,
}: {
  value: string;
  selected: boolean;
  outOfStock: boolean;
  onClick: () => void;
}) {
  // Map common color names to actual hex values. Falls back to slate grey
  // for unknown names — never crashes, just looks plain.
  const swatchColor = colorFromName(value);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={outOfStock ? `${value} (out of stock)` : value}
      title={outOfStock ? `${value} — out of stock` : value}
      onClick={onClick}
      className={cn(
        'group relative h-10 w-10 rounded-full cursor-pointer',
        'transition-all duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#002b5b] focus-visible:ring-offset-2',
        selected
          ? 'ring-2 ring-offset-2 ring-[#002b5b]'
          : 'ring-1 ring-slate-200 hover:ring-slate-300',
        outOfStock && !selected && 'opacity-50',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute inset-1 rounded-full border border-slate-200/60',
          outOfStock && 'border-dashed',
        )}
        style={{ backgroundColor: swatchColor }}
      />
      {selected && (
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center text-white"
        >
          <Check size={16} strokeWidth={3} />
        </span>
      )}
      {outOfStock && (
        // Diagonal strike-through line across the swatch.
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span className="block h-px w-[120%] rotate-45 bg-slate-400/80" />
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