import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatVnd } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { RevenueChartRow } from '../types/dashboard';

/* ──────────────────────────────────────────────────────────────────────────
 * Props
 * ────────────────────────────────────────────────────────────────────────── */

interface RevenueChartCardProps {
  data: RevenueChartRow[];
  isLoading?: boolean;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Skeleton
 * ────────────────────────────────────────────────────────────────────────── */

/** Chart-shaped skeleton — matches the card's inner dimensions so
 *  layout doesn't shift when data arrives. */
function ChartSkeleton() {
  return (
    <div className="h-64 w-full animate-pulse rounded-md bg-slate-50" aria-hidden />
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Custom Tooltip
 *
 * Recharts' `<Tooltip>` is fully controlled. We render a minimal card that:
 *   - Shows the formatted date (e.g. "15 Jul 2026")
 *   - Shows the formatted VND amount right-aligned
 *   - Uses the brand blue as the dot colour
 *   - Renders only when there's an active cursor position
 * ────────────────────────────────────────────────────────────────────────── */

interface TooltipPayloadItem {
  value: number;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;

  const amount = payload[0].value ?? 0;
  const date = label ? new Date(label) : null;
  const formattedDate = date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : label ?? '';

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-md px-3 py-2 min-w-[160px]">
      <p className="text-xs text-slate-500 mb-1">{formattedDate}</p>
      <p className="text-sm font-semibold text-slate-900 tabular-nums text-right">
        {formatVnd(amount)}
      </p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Date tick formatter for XAxis
 *
 * 30 data points is too dense to show every date label — show every
 * 5th day ("Jul 15") to keep the axis readable. We rely on Recharts'
 * `tick` value already being the ISO date string from our data.
 * ────────────────────────────────────────────────────────────────────────── */

function formatTick(dateStr: string, index: number): string {
  // Show every 5th label (0, 5, 10 …) to prevent crowding.
  if (index % 5 !== 0) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Amount tick formatter for YAxis
 *
 * Shortens large VND values: 1,200,000 → "1.2M", 850,000 → "850K".
 * Falls back to a plain comma-formatted number for values under 1,000.
 * ────────────────────────────────────────────────────────────────────────── */

function formatAmountTick(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return formatVnd(value);
}

/* ──────────────────────────────────────────────────────────────────────────
 * RevenueChartCard
 * ────────────────────────────────────────────────────────────────────────── */

/** Brand blue — matches the dashboard's `--color-brand` value. */
const BRAND_BLUE = '#002b5b';

export function RevenueChartCard({ data, isLoading }: RevenueChartCardProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="mb-5">
          <div className="h-5 w-40 rounded-md bg-slate-100 animate-pulse" />
          <div className="mt-1.5 h-4 w-64 rounded-md bg-slate-50 animate-pulse" />
        </div>
        <ChartSkeleton />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      {/* Card header */}
      <div className="mb-5">
        <h2 className="text-base font-semibold text-slate-900">
          Revenue over time
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Daily revenue for the last 30 days.
        </p>
      </div>

      {/* Area chart — full width, fixed 256 px tall. ResponsiveContainer
          makes it fill the parent width regardless of the card layout. */}
      <ResponsiveContainer width="100%" height={256}>
        <AreaChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={BRAND_BLUE} stopOpacity={0.15} />
              <stop offset="95%" stopColor={BRAND_BLUE} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Grid lines — subtle horizontal only, no vertical. */}
          <XAxis
            dataKey="date"
            tickFormatter={(val, idx) => formatTick(val, idx)}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tickFormatter={formatAmountTick}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            width={48}
          />

          {/* Custom tooltip — formatted VND, styled card */}
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }}
          />

          {/* Filled area — brand blue gradient fill */}
          <Area
            type="monotone"
            dataKey="amount"
            stroke={BRAND_BLUE}
            strokeWidth={2}
            fill="url(#revenueGradient)"
            dot={false}
            activeDot={{ r: 4, fill: BRAND_BLUE, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
