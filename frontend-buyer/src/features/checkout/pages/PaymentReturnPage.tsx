import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ShoppingBag,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { PageMeta } from '@/components/common/PageMeta';
import {
  paymentService,
  pollPaymentStatus,
  type PaymentPublic,
} from '@/services/paymentService';
import { formatVND } from '@/features/checkout/checkout.types';

/* ──────────────────────────────────────────────────────────────────────────
 * PaymentReturnPage — `/checkout/return`
 *
 * The VNPay sandbox (and any future gateway) lands here after the user
 * finishes (or aborts) payment. The page:
 *   1. Reads `paymentId` from the URL query string. VNPay also appends
 *      a bunch of `vnp_*` parameters — we strip those out and POST them
 *      to `/payments/:id/vnpay-return` so the backend can validate the
 *      HMAC SHA512 signature and flip the payment status.
 *   2. Polls `paymentService.verify(paymentId)` until the status leaves
 *      `pending` (or we hit our 5-attempt budget).
 *   3. Renders a clean success / failure card with the right CTAs.
 *
 * Cancel handling: VNPay echoes back to the same URL when the user
 * presses "Cancel" on the gateway page. The URL carries a
 * `status=cancelled` query param. We treat that as a *pending* state and
 * let the polling cycle handle the actual terminal verdict (the gateway
 * usually reports a `cancelled` or `failed` status within a few seconds).
 * If the user really did cancel, the final status will be `cancelled`
 * or `failed` and we'll render the failure card with a "Try Again" CTA.
 * ──────────────────────────────────────────────────────────────────────── */

const MAX_ATTEMPTS = 5;
const POLL_DELAY_MS = 1500;

/**
 * Pull every `vnp_*` key out of the URL query string. We strip our own
 * `paymentId` / `status` markers (added by the checkout page itself).
 */
function extractVnpayParams(
  searchParams: URLSearchParams,
): Record<string, string> {
  const out: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (key.startsWith('vnp_')) {
      out[key] = value;
    }
  });
  return out;
}

type ViewState =
  | { kind: 'verifying' }
  | { kind: 'success'; payment: PaymentPublic }
  | { kind: 'failure'; payment: PaymentPublic | null; reason: string }
  | { kind: 'error'; message: string };

export function PaymentReturnPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const paymentId = searchParams.get('paymentId') ?? undefined;
  const cancelledHint = searchParams.get('status') === 'cancelled';

  const [state, setState] = useState<ViewState>({ kind: 'verifying' });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancel any in-flight polling when the component unmounts (e.g. user
    // clicks "Back to orders") so we don't leak setState calls.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const run = async () => {
      if (!paymentId) {
        setState({
          kind: 'error',
          message:
            "We couldn't find the payment reference for this return. Please head back to your orders and try again.",
        });
        return;
      }

      // If VNPay echoed vnp_* params back to us, hand them to the backend
      // so it can verify the signature and update the status server-side.
      // We swallow errors here — verify() below will surface the truth.
      const vnpayParams = extractVnpayParams(searchParams);
      if (Object.keys(vnpayParams).length > 0) {
        try {
          await paymentService.submitVnpayReturn(paymentId, vnpayParams);
        } catch {
          // Backend may have already processed the callback via IPN, or
          // the signature is invalid (unlikely on the sandbox). Either
          // way, the polling below will catch up.
        }
      }

      try {
        const payment = await pollPaymentStatus(paymentId, {
          maxAttempts: MAX_ATTEMPTS,
          delayMs: POLL_DELAY_MS,
          signal: controller.signal,
        });

        // Terminal states — render the right card.
        if (payment.status === 'paid' || payment.status === 'processing') {
          setState({ kind: 'success', payment });
          // Friendly toast only on a fresh landing (not when the user
          // comes back to this page via the orders list).
          if (!cancelledHint) {
            toast.success('Payment confirmed!');
          }
        } else if (
          payment.status === 'cancelled' ||
          payment.status === 'failed'
        ) {
          setState({
            kind: 'failure',
            payment,
            reason:
              payment.status === 'cancelled'
                ? 'You cancelled the payment on the VNPay sandbox page.'
                : 'The payment gateway reported a failure. No charge was made.',
          });
        } else {
          // Still pending after MAX_ATTEMPTS — show a soft failure so the
          // user can decide whether to wait or retry.
          setState({
            kind: 'failure',
            payment,
            reason:
              "We're still waiting for confirmation from VNPay. You can try again in a moment, or check your orders for the latest status.",
          });
        }
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        const anyErr = err as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        const message =
          anyErr?.response?.data?.message ??
          anyErr?.message ??
          'Something went wrong while verifying your payment.';
        setState({ kind: 'error', message });
      }
    };

    void run();

    return () => {
      controller.abort();
    };
    // paymentId is the only thing that should trigger a re-run.
    // cancelledHint is informational only (toast gating).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId]);

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <>
      <PageMeta
        title={
          state.kind === 'verifying'
            ? 'Verifying payment…'
            : state.kind === 'success'
              ? 'Payment successful'
              : state.kind === 'failure'
                ? 'Payment not completed'
                : 'Payment error'
        }
        description="VNPay / MoMo / Stripe return URL — we verify your payment and show the result."
        noSuffix
      />
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {state.kind === 'verifying' && <VerifyingCard />}
      {state.kind === 'success' && (
        <SuccessCard payment={state.payment} onContinue={() => navigate('/orders')} />
      )}
      {state.kind === 'failure' && (
        <FailureCard
          reason={state.reason}
          paymentId={paymentId}
          onRetry={() => navigate('/checkout')}
          onOrders={() => navigate('/orders')}
        />
      )}
      {state.kind === 'error' && (
        <ErrorCard
          message={state.message}
          onOrders={() => navigate('/orders')}
          onCheckout={() => navigate('/checkout')}
        />
      )}

      <p className="mt-8 text-center text-xs text-slate-500">
        Need help?{' '}
        <Link
          to="/"
          className="font-medium text-[#002b5b] hover:text-[#001f3f] underline-offset-2 hover:underline"
        >
          Return to homepage
        </Link>
      </p>
    </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Sub-cards — one per terminal state. Each is a fully self-contained
 * visual block matching the rest of the design system.
 * ──────────────────────────────────────────────────────────────────────── */

function VerifyingCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 text-center">
      <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-brand-50 text-brand-700 mb-5 animate-pulse">
        <Loader2 size={28} className="animate-spin" aria-hidden />
      </div>
      <h1 className="text-2xl font-bold text-slate-900">
        Verifying your payment…
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Hang tight — we're confirming your payment with the gateway. This
        usually takes just a few seconds.
      </p>

      <div className="mt-8 max-w-sm mx-auto space-y-3 text-left">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6 mx-auto" />
        <Skeleton className="h-3 w-2/3 mx-auto" />
      </div>
    </div>
  );
}

interface SuccessCardProps {
  payment: PaymentPublic;
  onContinue: () => void;
}

function SuccessCard({ payment, onContinue }: SuccessCardProps) {
  const amount = formatVND(payment.amount);
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Success header band */}
      <div className="bg-success-50 px-8 py-6 border-b border-success-500/20 text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-white text-success-600 shadow-sm">
          <CheckCircle2 size={32} aria-hidden />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">
          Payment successful
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Thank you! Your order is being processed.
        </p>
      </div>

      {/* Receipt details */}
      <dl className="px-8 py-6 text-sm divide-y divide-slate-100">
        <div className="flex items-center justify-between py-3">
          <dt className="text-slate-500">Amount paid</dt>
          <dd className="font-semibold text-slate-900 tabular-nums">{amount}</dd>
        </div>
        <div className="flex items-center justify-between py-3">
          <dt className="text-slate-500">Payment method</dt>
          <dd className="font-medium text-slate-900 uppercase tracking-wide">
            {payment.gateway}
          </dd>
        </div>
        <div className="flex items-center justify-between py-3">
          <dt className="text-slate-500">Payment ID</dt>
          <dd className="font-mono text-xs text-slate-700 truncate max-w-[60%]">
            {payment.id}
          </dd>
        </div>
        <div className="flex items-center justify-between py-3">
          <dt className="text-slate-500">Orders</dt>
          <dd className="font-medium text-slate-900">
            {payment.orderIds.length}{' '}
            {payment.orderIds.length === 1 ? 'order' : 'orders'}
          </dd>
        </div>
      </dl>

      <div className="px-8 pb-8 flex flex-col sm:flex-row gap-3">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          leftIcon={<ShoppingBag size={16} aria-hidden />}
          onClick={onContinue}
        >
          View my orders
        </Button>
      </div>
    </div>
  );
}

interface FailureCardProps {
  reason: string;
  paymentId?: string;
  onRetry: () => void;
  onOrders: () => void;
}

function FailureCard({ reason, onRetry, onOrders }: FailureCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="bg-danger-50 px-8 py-6 border-b border-danger-500/20 text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-white text-danger-600 shadow-sm">
          <XCircle size={32} aria-hidden />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">
          Payment not completed
        </h1>
        <p className="mt-1 text-sm text-slate-600">{reason}</p>
      </div>

      <div className="px-8 py-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-2">
          What can you do?
        </h2>
        <ul className="text-sm text-slate-600 space-y-2 list-disc pl-5">
          <li>Try again — we'll reuse your cart and shipping details.</li>
          <li>
            Switch to <strong>Cash on Delivery</strong> if you'd rather not
            pay online right now.
          </li>
          <li>
            Check your order history — if the charge went through, the order
            will be marked <strong>Confirmed</strong>.
          </li>
        </ul>
      </div>

      <div className="px-8 pb-8 flex flex-col sm:flex-row gap-3">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          leftIcon={<RefreshCw size={16} aria-hidden />}
          onClick={onRetry}
        >
          Try again
        </Button>
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          leftIcon={<ArrowLeft size={16} aria-hidden />}
          onClick={onOrders}
        >
          View my orders
        </Button>
      </div>
    </div>
  );
}

interface ErrorCardProps {
  message: string;
  onOrders: () => void;
  onCheckout: () => void;
}

function ErrorCard({ message, onOrders, onCheckout }: ErrorCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 text-center">
      <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-danger-50 text-danger-600 mb-5">
        <XCircle size={28} aria-hidden />
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">{message}</p>
      <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
        <Button variant="primary" size="lg" onClick={onCheckout}>
          Back to checkout
        </Button>
        <Button variant="secondary" size="lg" onClick={onOrders}>
          View my orders
        </Button>
      </div>
    </div>
  );
}
