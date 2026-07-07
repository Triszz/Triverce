import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ChevronLeft,
  MapPin,
  Phone,
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

  return (
    <>
      <PageMeta
        title={`Order #${shortOrderId(order.id)}`}
        description={`Status: ${meta.label}. Placed on ${formatOrderDate(order.createdAt)}.`}
      />
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
      {/* Back link */}
      <button
        type="button"
        onClick={() => navigate('/orders')}
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors mb-4"
      >
        <ChevronLeft size={12} aria-hidden />
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
          {/* Items table */}
          <section className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <header className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">Items</h2>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th
                      scope="col"
                      className="w-1/2 py-4 px-5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                    >
                      Product
                    </th>
                    <th
                      scope="col"
                      className="py-4 px-5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                    >
                      Qty
                    </th>
                    <th
                      scope="col"
                      className="py-4 px-5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                    >
                      Unit price
                    </th>
                    <th
                      scope="col"
                      className="py-4 px-5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                    >
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <OrderItemRow key={item.id} item={item} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Shipping */}
          <section className="rounded-xl border border-slate-100 bg-white shadow-sm p-5">
            <header className="mb-4 flex items-center gap-2">
              <MapPin size={16} className="text-[#002b5b]" aria-hidden />
              <h2 className="text-sm font-semibold text-slate-900">
                Shipping details
              </h2>
            </header>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1">
                  Recipient
                </dt>
                <dd className="flex items-center gap-1.5 text-slate-900 font-medium">
                  <User size={13} className="text-slate-400" aria-hidden />
                  {order.shippingName}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1">
                  Phone
                </dt>
                <dd className="flex items-center gap-1.5 text-slate-900 font-medium tabular-nums">
                  <Phone size={13} className="text-slate-400" aria-hidden />
                  {order.shippingPhone}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1">
                  Address
                </dt>
                <dd className="text-slate-900 leading-relaxed">
                  {order.shippingAddress}
                </dd>
              </div>
              {order.note && (
                <div className="sm:col-span-2">
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1">
                    Note from buyer
                  </dt>
                  <dd className="text-slate-700 italic leading-relaxed">
                    "{order.note}"
                  </dd>
                </div>
              )}
            </dl>
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
              <p className="mt-0.5 text-xs text-slate-500">{meta.description}</p>
            </header>
            <OrderTimeline logs={order.statusLogs} />
          </section>

          {/* Totals + actions */}
          <section className="rounded-xl border border-slate-100 bg-white shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">
              Order total
            </h2>
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
                  {formatVND(0)}
                </dd>
              </div>
              <div className="border-t border-slate-200 pt-2 mt-2 flex items-center justify-between">
                <dt className="font-semibold text-slate-900">Total</dt>
                <dd className="text-lg font-bold text-slate-900 tabular-nums">
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
                <p className="text-xs text-slate-500 text-center">
                  This order can no longer be cancelled.
                </p>
              )}
              <Link
                to="/shop"
                className="block text-center text-xs font-medium text-[#002b5b] hover:text-[#001f3f] transition-colors"
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
