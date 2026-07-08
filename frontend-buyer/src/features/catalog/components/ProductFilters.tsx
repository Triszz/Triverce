import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
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
   * Debounce (ms) before `onChange` fires for the search field.
   * Defaults to 350 — long enough for typing, short enough to feel live.
   */
  searchDebounceMs?: number;
  className?: string;
}

/**
 * ProductFilters — controlled, debounced filter bar.
 *
 * Renders:
 *   • Search input (with debounce so we don't spam the API while typing).
 *   • Category pills (click to toggle; "All" resets).
 *   • Min / max price inputs.
 *   • Sort dropdown.
 *   • Clear-all reset button (shown only when something is set).
 */
export function ProductFilters({
  categories,
  value,
  onChange,
  searchDebounceMs = 350,
  className,
}: ProductFiltersProps) {
  /* Search has its own local state so the user can keep typing while
   * debouncing the actual filter change up to the parent. */
  const [searchDraft, setSearchDraft] = useState(value.search);

  // Track the last external value seen so we can reset the draft
  // without synchronously calling setState inside the effect.
  const lastExternalSearch = useRef(value.search);

  // Keep the draft in sync if the parent resets externally.
  useEffect(() => {
    if (value.search !== lastExternalSearch.current) {
      lastExternalSearch.current = value.search;
      setSearchDraft(value.search);
    }
  }, [value.search]);

  // Debounce: when the draft changes, schedule an onChange call.
  useEffect(() => {
    if (searchDraft === value.search) return;
    const handle = window.setTimeout(() => {
      onChange({ ...value, search: searchDraft.trim() });
    }, searchDebounceMs);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

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
        'space-y-4 rounded-xl bg-white border border-slate-100 shadow-sm p-4 sm:p-5',
        className,
      )}
    >
      {/* Row 1: search + sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            type="search"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search products by name…"
            leftIcon={<Search size={16} aria-hidden />}
            rightAddon={
              searchDraft ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchDraft('');
                    update({ search: '' });
                  }}
                  className="text-slate-400 hover:text-slate-700 transition-colors"
                  aria-label="Clear search"
                >
                  <X size={14} aria-hidden />
                </button>
              ) : null
            }
            aria-label="Search products"
          />
        </div>
        <div className="sm:w-56">
          <label htmlFor="sortBy" className="sr-only">
            Sort by
          </label>
          <select
            id="sortBy"
            value={value.sortBy}
            onChange={(e) =>
              update({ sortBy: e.target.value as ProductSort })
            }
            className="w-full"
          >
            {SORT_OPTIONS_LABELS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: category pills */}
      <div>
        <p
          className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2"
          id="filter-categories-label"
        >
          Categories
        </p>
        <div
          role="radiogroup"
          aria-labelledby="filter-categories-label"
          className="flex flex-wrap gap-2"
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

      {/* Row 3: price range + clear */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="grid grid-cols-2 gap-3 flex-1">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={value.minPrice ?? ''}
            onChange={(e) =>
              update({
                minPrice: e.target.value === '' ? null : Number(e.target.value),
              })
            }
            placeholder="Min price"
            label="Min price (VND)"
          />
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={value.maxPrice ?? ''}
            onChange={(e) =>
              update({
                maxPrice: e.target.value === '' ? null : Number(e.target.value),
              })
            }
            placeholder="Max price"
            label="Max price (VND)"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="md"
          disabled={!isActive}
          onClick={() => {
            setSearchDraft('');
            onChange(EMPTY_FILTERS);
          }}
          aria-label="Clear all filters"
        >
          Clear all
        </Button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Small pill primitive — kept local to this file.
 * ──────────────────────────────────────────────────────────────────────── */

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
        'rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-150',
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