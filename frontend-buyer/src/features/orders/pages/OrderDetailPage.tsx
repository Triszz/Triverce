import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ChevronLeft,
  CreditCard,
  MapPin,
  Phone,
  Store,
  User,
  XCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { PageMeta } from '@/components/common/PageMeta';
import {
  OrderItemRow,
  OrderTimeline,
} from '@/components/order';
import { useCancelOrder, useOrderDetail } from '@/hooks/useOrders';
import { formatVND } from '@/features/checkout/checkout.types';
import {
  cancelOrderSchema,
  type CancelOrderFormValues,
  getOrderStatusMeta,
  shortOrderId,
  formatOrderDate,
  type OrderStatus,
} from '@/features/orders/orders.types';
import type {
  OrderPublic,
  OrderItemPublic,
} from '@/services/orderService';

/* ──────────────────────────────────────────────────────────────────────────
 * OrderDetailPage — `/orders/:orderId`
 *
 * Five sections stacked in one column on mobile, two columns on
 * `lg:` (left = items + shipping, right = status/timeline/totals):
 *
 *   1. Header — short order ID, status badge, back link.
 *   2. Items table.
 *   3. Shipping details card.
 *   4. Timeline card.
 *   5. Totals card (with the cancel button when `status === 'pending'`).
 *
 * Cancel flow:
 *   • A "Cancel order" button only appears for `pending` orders.
 *   • Clicking it opens a `<Modal>` with a Zod-validated reason field
 *     (min 5 chars — mirrors the backend's `CancelOrderSchema`).
 *   • Successful submit closes the modal (handled implicitly by unmount)
 *     and surfaces a Sonner success toast via `useCancelOrder`.
 * ──────────────────────────────────────────────────────────────────────── */

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { data: order, isLoading, isError, error, refetch } =
    useOrderDetail(orderId);

  const { cancel, isCancelling } = useCancelOrder();
  const [isCancelOpen, setCancelOpen] = useState(false);

  /*
   * Per-store bucketing. Today every order has a single seller
   * (one order = one sellerId), so the result is always a
   * one-element array — but the bucketing is forward-compatible
   * with any future schema where one order can carry items from
   * multiple stores. Computed via useMemo so the same item
   * references stay stable across re-renders triggered by other
   * state (cancel modal open/close, etc.).
   *
   * Hooks-ordering note: this `useMemo` MUST live above every
   * early return below. The `isLoading` / `isError || !order`
   * branches exit the component before the data is ready, so
   * putting this hook there would violate React's "same number
   * and order of hooks on every render" rule and trip
   * `Rendered more hooks than during the previous render`.
   * The null-guard on `order` keeps it safe to call while
   * `order` is still `undefined`.
   */
  const storeGroups = useMemo(
    () => (order ? groupOrderItemsByStore(order) : []),
    [order],
  );

  /* ── Loading ────────────────────────────────────────────────────────── */

  if (isLoading) {
    return <OrderDetailSkeleton />;
  }

  /* ── Error ──────────────────────────────────────────────────────────── */

  if (isError || !order) {
    const message =
      (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message ??
      (error as { message?: string })?.message ??
      "We couldn't find this order. It may have been removed.";
    return (
      <>
        <PageMeta title="Order unavailable" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="rounded-xl border border-danger-100 bg-danger-50 p-8 text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-white text-danger-600 shadow-sm mb-4">
            <AlertTriangle size={24} aria-hidden />
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            Order unavailable
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
            {message}
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              variant="primary"
              size="md"
              onClick={() => refetch()}
              leftIcon={<RefreshCw size={15} aria-hidden />}
            >
              Try again
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => navigate('/orders')}
            >
              Back to my orders
            </Button>
          </div>
        </div>
      </div>
      </>
    );
  }

  /* ── Loaded ─────────────────────────────────────────────────────────── */

  const meta = getOrderStatusMeta(order.status as OrderStatus);
  const StatusIcon = meta.icon;
  const isPending = order.status === 'pending';
  const itemCount = order.items.reduce((s, it) => s + it.quantity, 0);

  /*
   * `storeGroups` was hoisted above the early returns — see the
   * hooks-ordering note at the top of the component. The value
   * is `[]` during loading/error, which is harmless because the
   * sections that consume it are not rendered on those paths.
   */

  return (
    <>
      <PageMeta
        title={`Order #${shortOrderId(order.id)}`}
        description={`Status: ${meta.label}. Placed on ${formatOrderDate(order.createdAt)}.`}
      />
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
      {/* Back link — bumped from text-xs / 12px → text-sm / 14px
       * to match the rest of the order-detail typography. */}
      <button
        type="button"
        onClick={() => navigate('/orders')}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors mb-4"
      >
        <ChevronLeft size={14} aria-hidden />
        Back to my orders
      </button>

      {/* Header */}
      <header className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Order #{shortOrderId(order.id)}
            </h1>
            <Badge tone={meta.tone}>
              <StatusIcon size={12} aria-hidden />
              {meta.label}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Placed on {formatOrderDate(order.createdAt)} · {itemCount}{' '}
            {itemCount === 1 ? 'item' : 'items'}
          </p>
        </div>
      </header>

      {/* Two-column layout (stacks on mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: items + shipping ─────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items section — bucketed by store so the buyer sees a
           * clear "Sold by <store>" header above each seller's
           * line items. Today every order has a single seller
           * (one order = one sellerId), so there is exactly one
           * group, but the bucketing is forward-compatible with
           * any future schema where one order can carry items
           * from multiple stores. */}
          <section className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <header className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">Items</h2>
            </header>
            {storeGroups.map((group) => (
              <div
                key={group.sellerId}
                className="border-b border-slate-100 last:border-b-0"
              >
                {/* Store header — `font-semibold text-slate-900
                 * hover:text-brand-600 transition-colors` per
                 * spec. We link to `/store/<sellerId>` so the
                 * buyer lands on the dedicated Store Detail
                 * page (the project's canonical seller landing
                 * surface). The Store icon gives a visual cue. */}
                <div className="flex items-center justify-between gap-2 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
                  <Link
                    to={`/store/${group.sellerId}`}
                    className="inline-flex items-center gap-2 font-semibold text-slate-900 hover:text-brand-600 transition-colors"
                  >
                    <Store size={16} className="text-slate-500" aria-hidden />
                    <span>
                      Sold by{' '}
                      {group.sellerStoreName ?? `Seller #${group.sellerId.slice(0, 8)}`}
                    </span>
                  </Link>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {group.items.length}{' '}
                    {group.items.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
                {/* Item rows — `role="list"` for AT navigation
                 * (the parent is a logical list of items). */}
                <div role="list">
                  {group.items.map((item) => (
                    <OrderItemRow key={item.id} item={item} />
                  ))}
                </div>
              </div>
            ))}
          </section>

          {/* Shipping */}
          <section className="rounded-xl border border-slate-100 bg-white shadow-sm p-5">
            <header className="mb-4 flex items-center gap-2">
              <MapPin size={16} className="text-[#002b5b]" aria-hidden />
              <h2 className="text-sm font-semibold text-slate-900">
                Shipping details
              </h2>
            </header>
            {/* Body text bumped text-sm → text-base so recipient
             * name, phone, and address read at the same scale as
             * product names and totals. */}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-base">
              <div>
                <dt className="text-sm font-medium uppercase tracking-wider text-slate-400 mb-1">
                  Recipient
                </dt>
                <dd className="flex items-center gap-1.5 text-slate-900 font-medium">
                  <User size={14} className="text-slate-400" aria-hidden />
                  {order.shippingName}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium uppercase tracking-wider text-slate-400 mb-1">
                  Phone
                </dt>
                <dd className="flex items-center gap-1.5 text-slate-900 font-medium tabular-nums">
                  <Phone size={14} className="text-slate-400" aria-hidden />
                  {order.shippingPhone}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium uppercase tracking-wider text-slate-400 mb-1">
                  Address
                </dt>
                <dd className="text-slate-900 leading-relaxed">
                  {order.shippingAddress}
                </dd>
              </div>
              {order.note && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium uppercase tracking-wider text-slate-400 mb-1">
                    Note from buyer
                  </dt>
                  <dd className="text-slate-700 italic leading-relaxed">
                    "{order.note}"
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* Payment method — mirrors the Shipping section's card
           * chrome (rounded-xl, slate-100 border, shadow-sm, p-5)
           * so the two read as siblings. The header swaps
           * `MapPin` → `CreditCard` to keep the iconography
           * consistent. The body shows the gateway label at
           * `text-base font-medium text-slate-900` and a
           * status chip below so the buyer can reconcile the
           * two values at a glance. */}
          <section
            className="rounded-xl border border-slate-100 bg-white shadow-sm p-5"
            aria-labelledby="payment-method-heading"
          >
            <header className="mb-4 flex items-center gap-2">
              <CreditCard size={16} className="text-[#002b5b]" aria-hidden />
              <h2
                id="payment-method-heading"
                className="text-sm font-semibold text-slate-900"
              >
                Payment method
              </h2>
            </header>
            <div className="space-y-1.5">
              <p className="text-base font-medium text-slate-900">
                {getPaymentMethodLabel(order.paymentMethod)}
              </p>
              <p className="text-sm text-slate-500 flex items-center gap-2">
                <span>Status:</span>
                <Badge tone={getPaymentStatusTone(order.paymentStatus)}>
                  {getPaymentStatusLabel(order.paymentStatus)}
                </Badge>
              </p>
            </div>
          </section>
        </div>

        {/* ── Right: timeline + totals + actions ────────────────────── */}
        <aside className="space-y-6">
          {/* Timeline */}
          <section className="rounded-xl border border-slate-100 bg-white shadow-sm p-5">
            <header className="mb-4">
              <h2 className="text-sm font-semibold text-slate-900">
                Status timeline
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">{meta.description}</p>
            </header>
            <OrderTimeline logs={order.statusLogs} />
          </section>

          {/* Totals + actions */}
          <section className="rounded-xl border border-slate-100 bg-white shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">
              Order total
            </h2>
            {/* Card body uses text-sm so the Items / Shipping labels
             * stay at the smaller "label" scale; values inherit
             * text-sm too. The Total row is the only place we
             * override to text-base for the "final number" weight. */}
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Items</dt>
                <dd className="text-slate-700 tabular-nums">
                  {formatVND(
                    order.items.reduce((s, it) => s + it.subtotal, 0),
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Shipping</dt>
                <dd className="text-slate-700 tabular-nums">
                  {order.shippingFee === 0 ? (
                    <span className="text-success-700 font-medium">Free</span>
                  ) : (
                    formatVND(order.shippingFee)
                  )}
                </dd>
              </div>
              <div className="border-t border-slate-200 pt-2 mt-2 flex items-center justify-between">
                <dt className="text-base font-semibold text-slate-900">Total</dt>
                <dd className="text-lg font-bold text-brand-600 tabular-nums">
                  {formatVND(order.totalAmount)}
                </dd>
              </div>
            </dl>

            {/* Actions */}
            <div className="mt-5 space-y-2">
              {isPending ? (
                <Button
                  variant="danger"
                  size="md"
                  fullWidth
                  leftIcon={<XCircle size={16} aria-hidden />}
                  onClick={() => setCancelOpen(true)}
                >
                  Cancel order
                </Button>
              ) : (
                <p className="text-sm text-slate-500 text-center">
                  This order can no longer be cancelled.
                </p>
              )}
              <Link
                to="/shop"
                className="block text-center text-sm font-medium text-[#002b5b] hover:text-[#001f3f] transition-colors"
              >
                Continue shopping →
              </Link>
            </div>
          </section>
        </aside>
      </div>

      {/* Cancel modal */}
      <CancelOrderModal
        open={isCancelOpen}
        onClose={() => setCancelOpen(false)}
        orderId={order.id}
        onCancel={async (reason) => {
          await cancel({ orderId: order.id, payload: { reason } });
          setCancelOpen(false);
        }}
        isSubmitting={isCancelling}
      />
    </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Payment-method display helpers
 *
 * `order.paymentMethod` and `order.paymentStatus` come back from
 * `GET /orders/:id` as raw enum strings (`momo`, `vnpay`, `cod`,
 * `paid`, `pending`, …). The UI wants friendly labels and a
 * status-tone badge.
 *
 * Maps are local to this file because:
 *   • `PAYMENT_METHOD_LABELS` mirrors the `CheckoutGateway` /
 *     backend `PaymentGateway` enums — co-locating it with the
 *     consumer avoids an import cycle if these labels ever need
 *     to differ between the seller dashboard and the buyer
 *     order-detail surface.
 *   • The helper functions take the wire type and return React-
 *     friendly strings — no domain logic, safe to define here.
 * ──────────────────────────────────────────────────────────────────────── */

/* eslint-disable @typescript-eslint/no-explicit-any */
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod: 'Cash on Delivery (COD)',
  vnpay: 'VNPay',
  momo: 'MoMo',
  stripe: 'Stripe',
};

/* `PaymentState` mirrors the backend `payment_status` enum:
 *   pending → processing → paid / failed / cancelled / refunded.
 * The labels mirror the wording used in the payment-history email
 * templates so buyers see the same copy across channels. */
const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  processing: 'Processing',
  paid: 'Paid',
  failed: 'Failed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

/**
 * Resolve a `paymentMethod` enum string to a buyer-friendly label.
 * Falls back to the raw value (title-cased) when the enum grows
 * and the backend ships a code we haven't mapped yet — keeps the
 * UI from rendering `undefined` or an empty string.
 */
function getPaymentMethodLabel(method: string | null | undefined): string {
  if (!method) return 'Not selected';
  return PAYMENT_METHOD_LABELS[method] ?? method.charAt(0).toUpperCase() + method.slice(1);
}

/** Same fallback policy as `getPaymentMethodLabel`. */
function getPaymentStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Unknown';
  return PAYMENT_STATUS_LABELS[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Map a `PaymentState` to a `Badge` tone so the chip colour
 * matches the rest of the order-detail page (paid = success,
 * failed/cancelled = danger, etc.). Defaults to `neutral` for
 * unknown values — same defensive policy as the label helpers.
 */
function getPaymentStatusTone(
  status: string | null | undefined,
): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'paid':
    case 'refunded':
      return 'success';
    case 'pending':
    case 'processing':
      return 'warning';
    case 'failed':
    case 'cancelled':
      return 'danger';
    default:
      return 'neutral';
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Per-store bucketing helper
 *
 * The order-detail page groups items by store so the buyer sees a
 * "Sold by …" header above each storefront's line items. Today
 * every order carries items from a single seller (the order's
 * `sellerId`), so the result is always a one-element array — but
 * the bucketing is forward-compatible with a future schema where
 * one order can carry items from multiple stores.
 *
 * Why a local helper instead of `groupCartItemsByStore` from
 * `@/features/cart/cartGrouping`: the cart helper operates on
 * `CartItemPublic`, which is structurally similar but a distinct
 * type. Importing it here would either need a type-cast or a
 * shared base type. The two are small, stable, and the risk of
 * drift is low (each surface renders its own store group
 * independently) — duplicating the few lines keeps the boundary
 * crisp.
 * ──────────────────────────────────────────────────────────────────────── */

export interface OrderStoreGroup {
  sellerId: string;
  sellerStoreName: string | null;
  items: OrderItemPublic[];
}

function groupOrderItemsByStore(order: OrderPublic): OrderStoreGroup[] {
  const groups: OrderStoreGroup[] = [];
  for (const item of order.items) {
    // The order wire carries the sellerId on the order, not on
    // each item. Every item in a single order belongs to the same
    // seller, so we key the group on the order-level sellerId.
    const existing = groups.find((g) => g.sellerId === order.sellerId);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.push({
        sellerId: order.sellerId,
        sellerStoreName: order.sellerStoreName ?? null,
        items: [item],
      });
    }
  }
  return groups;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Sub-components
 * ──────────────────────────────────────────────────────────────────────── */

function OrderDetailSkeleton() {
  return (
    <>
      <PageMeta title="Order details" />
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10" aria-busy>
      <Skeleton className="h-3 w-24 mb-4" />
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    </div>
    </>
  );
}

interface CancelOrderModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  isSubmitting: boolean;
  onCancel: (reason: string) => Promise<void>;
}

function CancelOrderModal({
  open,
  onClose,
  orderId,
  isSubmitting,
  onCancel,
}: CancelOrderModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<CancelOrderFormValues>({
    resolver: zodResolver(cancelOrderSchema),
    mode: 'onTouched',
    defaultValues: { reason: '' },
  });

  // Reset the form whenever the modal closes (so reopening starts clean).
  // We don't reset on open because that would wipe the user's typing.

  const onSubmit = handleSubmit(async (values) => {
    await onCancel(values.reason.trim());
    reset({ reason: '' });
  });

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!isSubmitting) {
          reset({ reason: '' });
          onClose();
        }
      }}
      title="Cancel this order?"
      meta={`Order #${shortOrderId(orderId)}`}
      size="md"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              reset({ reason: '' });
              onClose();
            }}
            disabled={isSubmitting}
          >
            Keep order
          </Button>
          <Button
            variant="danger"
            size="md"
            isLoading={isSubmitting}
            disabled={!isValid || isSubmitting}
            onClick={() => void onSubmit()}
          >
            Cancel order
          </Button>
        </div>
      }
    >
      <p className="text-sm text-slate-600 mb-4">
        We're sorry to see you go. Cancelling stops the seller from preparing
        your items. Let us know why so we can improve — at least 5 characters
        please.
      </p>

      <form onSubmit={onSubmit} className="space-y-1" noValidate>
        <Input
          label="Reason"
          placeholder="e.g. Ordered the wrong size"
          {...register('reason')}
          error={errors.reason?.message}
          autoFocus
        />
      </form>
    </Modal>
  );
}
