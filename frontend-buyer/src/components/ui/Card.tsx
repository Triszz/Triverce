import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * When true, applies a `hover:shadow-md transition-shadow duration-200`
   * — useful for clickable cards (ProductCard etc.).
   */
  interactive?: boolean;
  padded?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive, padded = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-white rounded-xl border border-slate-100 shadow-sm',
        interactive &&
          'transition-all duration-200 ease-out hover:shadow-md hover:-translate-y-0.5 cursor-pointer',
        padded && 'p-5',
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';
