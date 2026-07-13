/**
 * Locale-aware currency / number formatters for the seller dashboard.
 *
 * Uses Vietnamese đồng (VND) conventions by default since the backend
 * stores integers in VND. The currency code can be swapped via the
 * second argument for future multi-currency support.
 */

const DEFAULT_LOCALE = 'vi-VN';
const DEFAULT_CURRENCY = 'VND';

export function formatVnd(amount: number, currency = DEFAULT_CURRENCY): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0, // VND has no subunit
  }).format(amount);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE).format(value);
}