import { cn } from '@/lib/cn';

export interface PriceTagProps {
  value: number; // VND integer
  originalValue?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-3xl',
} as const;

const formatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export function PriceTag({
  value,
  originalValue,
  size = 'md',
  className,
}: PriceTagProps) {
  const isOnSale =
    typeof originalValue === 'number' && originalValue > value;

  /*
   * Two-span layout: the outer `<span>` is a flex container so
   * the (optional) strike-through `originalValue` sits next to the
   * main price on the same baseline; the inner `<span>` is where
   * the actual formatted number lives.
   *
   * IMPORTANT: the `className` prop is intentionally merged into
   * the INNER span (the one that renders the digits), NOT the
   * outer wrapper. The wrapper has no text content, so applying
   * `text-*` utilities there is a no-op — that was the previous
   * bug, and callers silently failed to recolour the price.
   *
   * `twMerge` (inside `cn`) resolves conflicting Tailwind
   * utilities in favour of the LAST occurrence, so a caller-supplied
   * `text-brand-600` wins over the default `text-slate-900` below.
   * The wrapper only receives the `size` utility so the optional
   * strike-through stays on the same scale as the main price.
   */
  return (
    <span className={cn('inline-flex items-baseline gap-2', SIZE[size])}>
      <span
        className={cn(
          'font-semibold tabular-nums tracking-tight',
          isOnSale ? 'text-danger-600' : 'text-slate-900',
          className,
        )}
      >
        {formatter.format(value)}
      </span>
      {isOnSale && (
        <span className="text-xs text-slate-400 line-through tabular-nums">
          {formatter.format(originalValue!)}
        </span>
      )}
    </span>
  );
}
