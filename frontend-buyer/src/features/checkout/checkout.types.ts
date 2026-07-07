import { z } from 'zod';
import type { CartItemPublic } from '@/services/cartService';

/* ──────────────────────────────────────────────────────────────────────────
 * Shared checkout constants + types.
 *
 * Kept in a dedicated file (no React component exports) so the
 * `react-refresh/only-export-components` ESLint rule doesn't complain
 * when a sibling component file (e.g. `OrderSummary.tsx`,
 * `ShippingForm.tsx`) also exports helpers that downstream consumers
 * (unit tests, the checkout page) rely on.
 * ──────────────────────────────────────────────────────────────────────── */

/* ── Shipping form schema + types ──────────────────────────────────────── */

/**
 * Field shape mirrors the backend `CreateOrderDto` exactly (see
 * backend/src/modules/order/order.dto.ts):
 *   • shippingName     — required, ≥ 2 chars
 *   • shippingPhone    — required, 9–11 digits (Vietnam format)
 *   • shippingAddress  — required, ≥ 10 chars
 *   • note             — optional, ≤ 500 chars
 */
export const shippingSchema = z.object({
  shippingName: z
    .string()
    .trim()
    .min(2, 'Please enter the recipient name (at least 2 characters)'),
  shippingPhone: z
    .string()
    .trim()
    .regex(/^[0-9]{9,11}$/, 'Phone number must be 9–11 digits'),
  shippingAddress: z
    .string()
    .trim()
    .min(10, 'Please enter a complete shipping address'),
  note: z
    .string()
    .trim()
    .max(500, 'Note must be 500 characters or fewer')
    .optional()
    .or(z.literal('')),
});

export type ShippingFormValues = z.infer<typeof shippingSchema>;

/**
 * Imperative handle exposed by `<ShippingForm>` so a remote "Place order"
 * button (rendered inside the OrderSummary sidebar) can trigger the
 * RHF submit cycle without being a DOM child of the form.
 */
export interface ShippingFormHandle {
  /** Triggers validation and the registered onSubmit if valid. */
  submit: () => void;
  /** True when every field passes its zod constraint. */
  isValid: boolean;
}

export interface ShippingFormProps {
  /** Optional initial values (e.g. when re-opening the page). */
  defaultValues?: Partial<ShippingFormValues>;
  /** Called with the validated payload. */
  onSubmit: (values: ShippingFormValues) => void | Promise<void>;
  className?: string;
}

/* ── OrderSummary prop types ──────────────────────────────────────────── */

export interface OrderSummaryProps {
  items: CartItemPublic[];
  subtotal: number;
  /** Pass the right-hand slot content (typically the Place Order button). */
  action?: React.ReactNode;
  className?: string;
}

export interface PlaceOrderButtonProps {
  isLoading?: boolean;
  disabled?: boolean;
  label?: string;
  loadingLabel?: string;
  onSubmit?: () => void;
}

/* ── Shipping fee policy ───────────────────────────────────────────────── */

/** Standard shipping fee in VND. */
export const SHIPPING_FEE = 30_000;

/** Subtotal threshold for free shipping, in VND. */
export const FREE_SHIPPING_THRESHOLD = 500_000;

/** Pure helper — derive the shipping fee from the subtotal. */
export function deriveShippingFee(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
}

/* ── Currency formatting ───────────────────────────────────────────────── */

/** Tiny local formatter used inside copy + buttons. */
export function formatVND(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}