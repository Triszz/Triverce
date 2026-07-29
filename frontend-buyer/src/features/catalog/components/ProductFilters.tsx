import { cn } from '@/lib/cn';
import type { Category } from '@/services/categoryService';
import type { ProductSort } from '@/services/productService';
import {
  EMPTY_FILTERS,
  type ProductFiltersValue,
} from './ProductFilters.constants';

/* Sort options exposed in the UI. Kept human-readable. */
const SORT_OPTIONS_LABELS: Array<{ value: ProductSort; label: string }> = [
  { value: 'created_desc', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'name_asc', label: 'Name: A → Z' },
  { value: 'name_desc', label: 'Name: Z → A' },
];

export interface ProductFiltersProps {
  /** Categories to render as pills. Parent decides which to fetch. */
  categories: Category[];
  value: ProductFiltersValue;
  onChange: (next: ProductFiltersValue) => void;
  /**
   * Fired by the "Clear all" button. Defaults to `() => onChange(EMPTY_FILTERS)`,
   * which strips every filter param via the URL hook. Parents can pass a
   * dedicated reset (e.g. `useCatalogFilters().reset`) to wipe the URL state
   * even when the parent’s `setFilters` implementation keeps values intact.
   */
  onReset?: () => void;
  className?: string;
}

/**
 * ProductFilters — controlled filter bar for `/shop`.
 *
 * Layout (top to bottom):
 *   Row 1 — Categories label + horizontally-wrapping pills.
 *   Row 2 — Price range (Min ─ Max) on the left, Sort dropdown + Clear-all
 *           link on the right.
 *
 * Search is intentionally *not* rendered here: the global Header search bar
 * is the single entry point for `?q=` on this page. The page-level filter
 * hook (`useCatalogFilters`) still reads `q` from the URL, so the
 * underlying search behaviour is preserved — only the redundant UI is gone.
 */
export function ProductFilters({
  categories,
  value,
  onChange,
  onReset,
  className,
}: ProductFiltersProps) {
  const update = (patch: Partial<ProductFiltersValue>) =>
    onChange({ ...value, ...patch });

  const isActive =
    value.search !== '' ||
    value.categoryId !== null ||
    value.minPrice !== null ||
    value.maxPrice !== null ||
    value.sortBy !== 'created_desc';

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl bg-white border border-slate-100 shadow-sm p-4 sm:p-5',
        className,
      )}
    >
      {/* ── Row 1: Categories ──────────────────────────────────────── */}
      <div>
        <p
          className="text-xs font-semibold uppercase tracking-wider text-slate-500"
          id="filter-categories-label"
        >
          Categories
        </p>
        <div
          role="radiogroup"
          aria-labelledby="filter-categories-label"
          className="flex flex-wrap gap-2 mt-2"
        >
          <CategoryPill
            active={value.categoryId === null}
            onClick={() => update({ categoryId: null })}
          >
            All
          </CategoryPill>
          {categories.map((cat) => (
            <CategoryPill
              key={cat.id}
              active={value.categoryId === cat.id}
              onClick={() =>
                update({
                  categoryId: value.categoryId === cat.id ? null : cat.id,
                })
              }
            >
              {cat.name}
            </CategoryPill>
          ))}
        </div>
      </div>

      {/* ── Divider ────────────────────────────────────────────────── */}
      <div className="border-t border-slate-100 my-6" />

      {/* ── Row 2: Price | Sort & Clear ────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        {/* Left: Price range — two equal-width fields flanking a dash. */}
        <div className="flex items-end gap-3 flex-1 min-w-0">
          <PriceField
            id="filter-min-price"
            label="Min price"
            value={value.minPrice}
            onChange={(n) => update({ minPrice: n })}
          />
          <span className="pb-2.5 text-slate-400 select-none">–</span>
          <PriceField
            id="filter-max-price"
            label="Max price"
            value={value.maxPrice}
            onChange={(n) => update({ maxPrice: n })}
          />
        </div>

        {/* Right: Sort + Clear */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex flex-col">
            <label
              htmlFor="sortBy"
              className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1"
            >
              Sort by
            </label>
            <select
              id="sortBy"
              value={value.sortBy}
              onChange={(e) =>
                update({ sortBy: e.target.value as ProductSort })
              }
              className="h-11"
            >
              {SORT_OPTIONS_LABELS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => (onReset ? onReset() : onChange(EMPTY_FILTERS))}
            disabled={!isActive}
            className={cn(
              'self-end text-sm font-medium transition-colors mb-2.5',
              isActive
                ? 'text-blue-600 hover:text-blue-800 cursor-pointer'
                : 'text-slate-400 cursor-not-allowed',
            )}
            aria-label="Clear all filters"
          >
            Clear all
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Small primitives — kept local to this file.
 * ──────────────────────────────────────────────────────────────────────── */

interface PriceFieldProps {
  id: string;
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
}

/** Compact price input — labeled, fills its share of the row, height-aligned
 *  to the sort `<select>` so the controls sit on the same baseline. */
function PriceField({ id, label, value, onChange }: PriceFieldProps) {
  return (
    <div className="flex flex-col flex-1 min-w-[150px]">
      <label
        htmlFor={id}
        className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1"
      >
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        value={value ?? ''}
        onChange={(e) =>
          onChange(e.target.value === '' ? null : Number(e.target.value))
        }
        placeholder="0"
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 focus:border-[#002b5b] focus:outline-none focus:ring-2 focus:ring-[#002b5b]/20 transition-colors"
      />
    </div>
  );
}

function CategoryPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-150 cursor-pointer',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#002b5b] focus-visible:ring-offset-2',
        active
          ? 'bg-[#002b5b] text-white shadow-sm hover:bg-[#001f3f]'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
      )}
    >
      {children}
    </button>
  );
}