import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const badgeStyles = cva(
  'inline-flex items-center gap-1 font-medium whitespace-nowrap transition-colors',
  {
    variants: {
      tone: {
        success: 'bg-success-50 text-success-700 ring-1 ring-success-500/20',
        warning: 'bg-warning-50 text-warning-700 ring-1 ring-warning-500/20',
        danger:  'bg-danger-50  text-danger-700  ring-1 ring-danger-500/20',
        info:    'bg-info-50    text-info-700    ring-1 ring-info-500/20',
        neutral: 'bg-slate-100  text-slate-700   ring-1 ring-slate-200',
        brand:   'bg-brand-50   text-brand-700   ring-1 ring-brand-700/20',
      },
      size: {
        sm: 'text-[10px] px-2 py-0.5 rounded-md',
        md: 'text-xs px-2.5 py-1 rounded-full',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeStyles> {}

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeStyles({ tone, size }), className)} {...props} />;
}
