import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  BoxIcon,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  MapPin,
  Package,
  Phone,
  Truck,
  User,
} from 'lucide-react';
import { formatVnd } from '@/lib/format';
import { toAbsoluteUrl } from '@/lib/url';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { cn } from '@/lib/cn';
import {
  useCancelOrder,
  useOrderDetails,
  useUpdateOrderStatus,
} from '../hooks/useOrders';
import { OrderStatusBadge } from '../components/OrderStatusBadge';
import {
  nextOrderStatuses,
  type OrderItem,
  type OrderStatus,
  type OrderStatusLog,
  type PaymentMethod,
  type PaymentState,
  type UpdateableOrderStatus,
} from '@/types/order';

/* ──────────────────────────────────────────────────────────────────────────
 * Status-action button config
 *
 * Each `UpdateableOrderStatus` we can drive the order into gets a
 * button. `confirmed/shipping/delivered` use the brand blue; `cancelled`
 * is destructive so it gets the red treatment. The Cancel button uses
 * a different endpoint (`PATCH /cancel`) because it can trigger a
 * refund — see `useCancelOrder` and `OrderService.cancelOrder`.
 *
 * Labels are intentionally action-y ("Confirm order", not just
 * "Confirmed") so the seller reads them as verbs. Loading text
 * follows our established pattern: "{verb}ing…".
 * ────────────────────────────────────────────────────────────────────────── */

interface StatusActionConfig {
  label: string;
  pendingLabel: string;
  variant: 'primary' | 'success' | 'destructive';
}

const STATUS_ACTION: Record<UpdateableOrderStatus, StatusActionConfig> = {
  confirmed: {
    label: 'Confirm order',
    pendingLabel: 'Confirming…',
    variant: 'primary',
  },
  shipping: {
    label: 'Ship order',
    pendingLabel: 'Shipping…',
    variant: 'primary',
  },
  delivered: {
    label: 'Mark as delivered',
    pendingLabel: 'Updating…',
    variant: 'success',
  },
  cancelled: {
    label: 'Cancel order',
    pendingLabel: 'Cancelling…',
    variant: 'destructive',
  },
};

/* ──────────────────────────────────────────────────────────────────────────
 * Date formatter (mirrors OrdersListPage; kept local so the file is
 * self-contained — a future i18n pass will pull these into a hook).
 * ────────────────────────────────────────────────────────────────────────── */

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Payment method / status display
 *
 * The backend now exposes `paymentMethod` + `paymentStatus` on the
 * order (Issue #3 fix). We render them as a single "Method - Status"
 * pill with semantic color coding so the seller can read at a glance
 * whether payment is pending, settled, or refunded.
 * ────────────────────────────────────────────────────────────────────────── */

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  vnpay: 'VNPay',
  momo: 'MoMo',
  stripe: 'Stripe',
  cod: 'COD',
};

const PAYMENT_STATE_CLS: Record<
  PaymentState,
  { bg: string; text: string; border: string; dot: string }
> = {
  pending: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  processing: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  paid: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  failed: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    dot: 'bg-red-500',
  },
  cancelled: {
    bg: 'bg-slate-50',
    text: 'text-slate-600',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
  refunded: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
};

function paymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHOD_LABEL[method];
}

function paymentStateLabel(state: PaymentState): string {
  // Capitalize first letter for display ("paid" → "Paid"). The wire
  // is lower-case; the dashboard reads better with a leading cap.
  return state.charAt(0).toUpperCase() + state.slice(1);
}

export function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const orderId = params.id ?? '';

  const { data: order, isLoading, isError, error, refetch } = useOrderDetails(orderId);

  // The two mutations are conditionally instantiated only once we have
  // an order (so we know it's a seller-owned order and not a 404).
  // They're created here and passed down so the action bar can render
  // both without recreating hooks per render.
  const statusMutation = useUpdateOrderStatus(orderId);
  const cancelMutation = useCancelOrder(orderId);

  // Cancel dialog state. We open it from the action bar; the input
  // captured here is sent straight to the `cancelOrder` endpoint.
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  /* ── Loading & error ────────────────────────────────────────────────── */

  if (isLoading) return <DetailSkeleton />;

  if (isError || !order) {
    return (
      <ErrorState
        message={(error as Error)?.message ?? 'Order not found'}
        onRetry={() => void refetch()}
        onBack={() => navigate('/orders')}
      />
    );
  }

  /* ── Derived data ───────────────────────────────────────────────────── */

  const validNextStatuses = nextOrderStatuses(order.status);
  const subtotal = order.items.reduce((sum, i) => sum + i.subtotal, 0);
  const shippingFee = order.totalAmount - subtotal; // No shipping breakdown on the wire; derive from grand total.
  // shippingFee can be negative if pricing rules change — clamp to 0
  // for display so the totals card never shows a credit under "Shipping".
  const displayShipping = Math.max(0, shippingFee);

  const isAnyActionPending = statusMutation.isPending || cancelMutation.isPending;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <Link
          to="/orders"
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
          aria-label="Back to orders"
        >
          <ArrowLeft size={18} aria-hidden />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 font-mono">
              #{order.id.slice(0, 8)}
            </h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Placed on {formatDate(order.createdAt)}
            {order.updatedAt !== order.createdAt && (
              <> · Updated {formatDate(order.updatedAt)}</>
            )}
          </p>
        </div>
      </div>

      {/* Action bar — only renders when the order has at least one legal
          next status. Terminal statuses (delivered/cancelled/failed)
          render an info chip instead so the seller knows it's locked. */}
      {validNextStatuses.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-medium text-slate-900">
              Available actions
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Pick the next step for this order. All transitions are
              audited on the order's status log.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {validNextStatuses.map((next) => (
              <ActionButton
                key={next}
                next={next}
                config={STATUS_ACTION[next]}
                disabled={isAnyActionPending}
                isPending={
                  next === 'cancelled'
                    ? cancelMutation.isPending
                    : statusMutation.isPending
                }
                onClick={() => {
                  if (next === 'cancelled') {
                    setCancelReason('');
                    setCancelDialogOpen(true);
                  } else {
                    statusMutation.mutate({ status: next });
                  }
                }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-xl border border-slate-200 px-6 py-4 flex items-center gap-3">
          <Ban size={16} className="text-slate-400" aria-hidden />
          <p className="text-sm text-slate-600">
            This order is{' '}
            <span className="font-medium">{order.status}</span> — no further
            transitions are allowed.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column: items + timeline ────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200">
            <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Items
              </h2>
              <span className="text-xs text-slate-500">
                {order.items.length} line
                {order.items.length === 1 ? '' : 's'}
              </span>
            </header>
            <ul className="divide-y divide-slate-100">
              {order.items.map((item) => (
                <OrderItemRow key={item.id} item={item} />
              ))}
            </ul>
          </section>

          {/* Status timeline */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200">
            <header className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                Status history
              </h2>
            </header>
            {order.statusLogs.length === 0 ? (
              <p className="px-6 py-6 text-sm text-slate-500">
                No status changes recorded yet.
              </p>
            ) : (
              <StatusTimeline logs={order.statusLogs} />
            )}
          </section>
        </div>

        {/* ── Right column: shipping + totals ─────────────────────────── */}
        <div className="space-y-6">
          {/* Shipping card */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200">
            <header className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                Customer & shipping
              </h2>
            </header>
            <div className="px-6 py-4 space-y-4">
              <DetailRow icon={User} label="Recipient" value={order.shippingName} />
              <DetailRow icon={Phone} label="Phone" value={order.shippingPhone} mono />
              <DetailRow
                icon={MapPin}
                label="Address"
                value={order.shippingAddress}
              />
              {order.note && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1">
                    Customer note
                  </p>
                  <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-200">
                    {order.note}
                  </p>
                </div>
              )}
              {order.cancelledReason && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-red-600 mb-1">
                    Cancellation reason
                  </p>
                  <p className="text-sm text-slate-700 bg-red-50 rounded-lg p-3 border border-red-200">
                    {order.cancelledReason}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Totals */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200">
            <header className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                Order summary
              </h2>
            </header>
            <div className="px-6 py-4 space-y-2 text-sm">
              <TotalRow label="Subtotal" value={subtotal} />
              <TotalRow label="Shipping" value={displayShipping} />
              <div className="h-px bg-slate-100 my-2" />
              <TotalRow label="Grand total" value={order.totalAmount} bold />
            </div>
          </section>

          {/* Payment card — now displays real method + status from the
              joined payment row (Issue #3 fix). Falls back to a neutral
              "No payment linked" chip when the order has no paymentId
              (rare — almost every checkout creates a payment row). */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 px-6 py-4">
            <div className="flex items-center gap-2">
              <CreditCard size={16} className="text-slate-400" aria-hidden />
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Payment
              </p>
            </div>
            <div className="mt-2">
              {order.paymentMethod && order.paymentStatus ? (
                <PaymentBadge
                  method={order.paymentMethod}
                  state={order.paymentStatus}
                />
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
                  <span aria-hidden className="w-2 h-2 rounded-full bg-slate-400" />
                  No payment linked
                </span>
              )}
            </div>
            {order.paymentId && (
              <p className="mt-2 text-[11px] text-slate-400 font-mono break-all">
                {order.paymentId}
              </p>
            )}
          </section>
        </div>
      </div>

      {/* Cancel confirmation modal — collects a reason (server requires
          ≥5 chars) and routes through `useCancelOrder`. Kept separate
          from the destructive action button so we can show a richer UI. */}
      <ConfirmDialog
        isOpen={cancelDialogOpen}
        isDestructive
        title="Cancel this order?"
        description="A cancellation reason is required for the audit log. If the order was already paid, a refund will be initiated through the payment gateway."
        confirmText={
          cancelMutation.isPending ? 'Cancelling…' : 'Cancel order'
        }
        cancelText="Keep order"
        isConfirming={cancelMutation.isPending}
        onCancel={() => setCancelDialogOpen(false)}
        onConfirm={() => {
          const reason = cancelReason.trim() || 'Seller cancelled order';
          cancelMutation.mutate(
            { reason },
            {
              onSuccess: () => setCancelDialogOpen(false),
            },
          );
        }}
      />

      {/* Hidden reason input rendered above the dialog so the modal can
          collect text. We render it in a sibling portal-style container
          when the dialog is open; otherwise it's not in the tree. */}
      {cancelDialogOpen && (
        <CancelReasonInput
          value={cancelReason}
          onChange={setCancelReason}
          isPending={cancelMutation.isPending}
        />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Action button — single component drives the entire valid-next-states
 * array. Variants map to color sets; pending state disables + swaps
 * label to the {verb}ing… pattern.
 * ────────────────────────────────────────────────────────────────────────── */

function ActionButton({
  next,
  config,
  disabled,
  isPending,
  onClick,
}: {
  next: UpdateableOrderStatus;
  config: StatusActionConfig;
  disabled: boolean;
  isPending: boolean;
  onClick: () => void;
}) {
  const isCancel = next === 'cancelled';

  // While this specific button is pending, show a spinner in addition
  // to swapping the label. Other buttons in the row stay disabled but
  // stop showing their own spinners to avoid noise.
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors shadow-sm',
        'disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
        config.variant === 'primary' &&
          'bg-[#002b5b] text-white hover:bg-[#001f3f]',
        config.variant === 'success' &&
          'bg-emerald-600 text-white hover:bg-emerald-700',
        config.variant === 'destructive' &&
          'bg-white border border-red-300 text-red-700 hover:bg-red-50',
        // Cancel has no shadow — secondary destructive feel
        isCancel && 'shadow-none',
      )}
    >
      {isPending && <Loader2 size={14} className="animate-spin" aria-hidden />}
      {isPending ? config.pendingLabel : config.label}
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Order item row
 *
 * Now renders the variant image (Issue #1 fix) and resolved attribute
 * chips ("Size: M · Color: Red") pulled from the variant relation.
 * Falls back to a placeholder icon when `imageUrl` is null, which is
 * normal for variants that were created without an uploaded image.
 * ────────────────────────────────────────────────────────────────────────── */

function OrderItemRow({ item }: { item: OrderItem }) {
  const imgUrl = toAbsoluteUrl(item.imageUrl);

  return (
    <li className="px-6 py-4 flex items-center gap-4">
      {/* Variant image (with placeholder fallback). We lazy-load to
          avoid blocking the initial paint — the row count per order
          is small, but the dashboard might render multiple orders
          side-by-side in a future scrollable variant. */}
      <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={item.productName}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <Package size={20} className="text-slate-400" aria-hidden />
        )}
      </div>

      {/* Item details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">
          {item.productName}
        </p>
        <p className="mt-0.5 text-xs text-slate-500 font-mono">
          SKU: {item.variantSku}
        </p>
        {item.attributes.length > 0 ? (
          <div className="mt-1 flex items-center gap-1 flex-wrap">
            {item.attributes.map((attr) => (
              <span
                key={attr.name}
                className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200"
              >
                {attr.name}: {attr.value}
              </span>
            ))}
          </div>
        ) : null}
        <p className="mt-1 text-xs text-slate-500">
          {formatVnd(item.unitPrice)} × {item.quantity}
        </p>
      </div>

      {/* Subtotal */}
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-slate-900 tabular-nums">
          {formatVnd(item.subtotal)}
        </p>
      </div>
    </li>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Status timeline — vertical list with icon per status.
 * ────────────────────────────────────────────────────────────────────────── */

const STATUS_ICON: Record<
  OrderStatus,
  { Icon: typeof Clock; cls: string; label: string }
> = {
  pending: {
    Icon: Clock,
    cls: 'bg-amber-100 text-amber-700 border-amber-200',
    label: 'Pending',
  },
  confirmed: {
    Icon: CheckCircle2,
    cls: 'bg-blue-100 text-blue-700 border-blue-200',
    label: 'Confirmed',
  },
  shipping: {
    Icon: Truck,
    cls: 'bg-blue-100 text-blue-700 border-blue-200',
    label: 'Shipping',
  },
  delivered: {
    Icon: CheckCircle2,
    cls: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    label: 'Delivered',
  },
  cancelled: {
    Icon: Ban,
    cls: 'bg-red-100 text-red-700 border-red-200',
    label: 'Cancelled',
  },
  failed: {
    Icon: AlertTriangle,
    cls: 'bg-red-100 text-red-700 border-red-200',
    label: 'Failed',
  },
};

function StatusTimeline({ logs }: { logs: OrderStatusLog[] }) {
  // Render top-to-bottom; reverse-chronological isn't necessary — the
  // backend returns logs ascending (see `loadStatusLogs` in repo).
  return (
    <ol className="px-6 py-4 space-y-4">
      {logs.map((log, idx) => {
        const cfg = STATUS_ICON[log.toStatus];
        const Icon = cfg.Icon;
        const isLast = idx === logs.length - 1;
        return (
          <li key={idx} className="relative flex gap-3">
            {/* Connector line */}
            {!isLast && (
              <span
                aria-hidden
                className="absolute left-[15px] top-8 bottom-0 -mb-4 w-px bg-slate-200"
              />
            )}
            <span
              className={cn(
                'mt-0.5 inline-flex w-8 h-8 shrink-0 items-center justify-center rounded-full border',
                cfg.cls,
              )}
            >
              <Icon size={14} aria-hidden />
            </span>
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                {log.fromStatus && (
                  <>
                    <OrderStatusBadge status={log.fromStatus} size="sm" />
                    <span aria-hidden className="text-slate-400">→</span>
                  </>
                )}
                <OrderStatusBadge status={log.toStatus} size="sm" />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {formatDateShort(log.createdAt)}
                {log.changedBy && (
                  <span className="ml-1">· by {log.changedBy.slice(0, 8)}</span>
                )}
              </p>
              {log.note && (
                <p className="mt-1.5 text-xs text-slate-600 bg-slate-50 rounded px-2 py-1 border border-slate-200">
                  {log.note}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Small presentational helpers
 * ────────────────────────────────────────────────────────────────────────── */

function DetailRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof User;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
        <Icon size={12} aria-hidden /> {label}
      </p>
      <p
        className={cn(
          'text-sm text-slate-900',
          mono && 'font-mono tabular-nums',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function TotalRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn('text-slate-600', bold && 'text-slate-900 font-semibold')}>
        {label}
      </span>
      <span
        className={cn(
          'tabular-nums',
          bold
            ? 'text-base font-bold text-slate-900'
            : 'text-slate-700',
        )}
      >
        {formatVnd(value)}
      </span>
    </div>
  );
}

/**
 * Payment badge — "VNPay - Paid", "COD - Pending", etc.
 *
 * Two visual layers in one pill: the gateway method on the left (in
 * normal-weight slate) and the payment state on the right (with
 * semantic color from `PAYMENT_STATE_CLS`). A small leading dot
 * carries the state color so the badge reads at a glance even when
 * the seller scans down a row.
 */
function PaymentBadge({
  method,
  state,
}: {
  method: PaymentMethod;
  state: PaymentState;
}) {
  const cls = PAYMENT_STATE_CLS[state];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
        cls.bg,
        cls.text,
        cls.border,
      )}
      aria-label={`${paymentMethodLabel(method)} payment ${paymentStateLabel(state)}`}
    >
      <span aria-hidden className={cn('w-2 h-2 rounded-full', cls.dot)} />
      <span className="font-semibold">{paymentMethodLabel(method)}</span>
      <span aria-hidden className="text-slate-300">·</span>
      <span>{paymentStateLabel(state)}</span>
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Cancel-reason input
 *
 * Rendered as a sibling of the ConfirmDialog (which doesn't carry
 * inputs) so the seller can enter the cancellation reason. The
 * component is conditionally mounted, so it only exists when the
 * dialog is open. It sits visually inline with the modal thanks to
 * a fixed-position card centered above the dialog backdrop.
 * ────────────────────────────────────────────────────────────────────────── */

function CancelReasonInput({
  value,
  onChange,
  isPending,
}: {
  value: string;
  onChange: (v: string) => void;
  isPending: boolean;
}) {
  // We rely on the dialog's own buttons to call onConfirm. This
  // component is purely a text collector.
  return (
    <div
      className="fixed inset-x-0 top-24 z-[60] mx-auto w-full max-w-md px-4 pointer-events-none"
    >
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-4 pointer-events-auto">
        <label
          htmlFor="cancel-reason"
          className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-1.5"
        >
          Cancellation reason (required)
        </label>
        <textarea
          id="cancel-reason"
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={isPending}
          placeholder="e.g. Out of stock, customer requested cancellation…"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#002b5b]/20 focus:border-[#002b5b] disabled:opacity-50 disabled:cursor-not-allowed resize-none"
        />
        <p className="mt-1 text-[11px] text-slate-400">
          Minimum 5 characters. This is saved on the order's audit log.
        </p>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Skeleton / error states
 * ────────────────────────────────────────────────────────────────────────── */

function DetailSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-200" />
        <div className="space-y-2 flex-1">
          <div className="h-7 w-48 rounded bg-slate-200" />
          <div className="h-4 w-72 rounded bg-slate-100" />
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 h-20" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 h-64" />
          <div className="bg-white rounded-xl border border-slate-200 h-40" />
        </div>
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 h-56" />
          <div className="bg-white rounded-xl border border-slate-200 h-32" />
        </div>
      </div>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
  onBack,
}: {
  message: string;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-6 py-12 text-center">
        <BoxIcon size={28} className="mx-auto text-slate-300 mb-2" aria-hidden />
        <p className="text-base font-semibold text-red-600">
          Failed to load order
        </p>
        <p className="mt-1 text-sm text-slate-500">{message}</p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            Back to orders
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 rounded-lg bg-[#002b5b] text-white text-sm font-medium hover:bg-[#001f3f] cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}