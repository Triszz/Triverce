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

  return (
    <span className={cn('inline-flex items-baseline gap-2', className)}>
      <span
        className={cn(
          'font-semibold tabular-nums tracking-tight',
          isOnSale ? 'text-danger-600' : 'text-slate-900',
          SIZE[size],
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
