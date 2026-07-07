import { useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ShoppingBag, LogIn, ChevronLeft, Lock, Truck } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCart } from '@/hooks/useCart';
import { useUiStore } from '@/stores/useUiStore';
import { orderService, type CheckoutResponse } from '@/services/orderService';
import { paymentService } from '@/services/paymentService';
import {
  GatewaySelector,
  type CheckoutGateway,
} from '@/features/checkout/GatewaySelector';
import { ShippingForm } from '@/features/checkout/ShippingForm';
import {
  OrderSummary,
  PlaceOrderButton,
} from '@/features/checkout/OrderSummary';
import { PageMeta } from '@/components/common/PageMeta';
import {
  deriveShippingFee,
  formatVND,
  type ShippingFormHandle,
  type ShippingFormValues,
} from '@/features/checkout/checkout.types';

/* ──────────────────────────────────────────────────────────────────────────
 * CheckoutPage — `/checkout`
 *
 * Flow:
 *   1. Auth gate → /auth/login if guest
 *   2. Cart gate → /cart if empty
 *   3. Render form + gateway picker + summary
 *   4. Submit →
 *        a. orderService.createOrder — creates the order(s) + Payment(s).
 *           For VNPay the backend also calls the gateway to mint a URL.
 *        b. We rebuild the return/cancel URLs with the *real* paymentId
 *           and call paymentService.retry to get a fresh gateway URL
 *           (this lets us echo `?paymentId=…` back to the return page
 *           so PaymentReturnPage can verify without an extra lookup).
 *        c. Redirect (VNPay) or navigate to /orders (COD).
 *
 * Why the two-call pattern for VNPay?
 *   The backend creates the Payment record with a generated paymentId,
 *   then immediately forwards a session request to VNPay with whatever
 *   returnUrl the client passed in. To guarantee the paymentId ends up
 *   in the echoed returnUrl we re-issue the gateway session after the
 *   checkout call. paymentService.retry is idempotent for `pending`
 *   payments (see backend/src/modules/payment/payment.service.ts).
 *
 * Backend notes:
 *   • Inventory is locked inside the checkout transaction. If any variant
 *     is short-stocked the controller returns a 400 with the offending
 *     SKU in the message — we surface that via a Sonner toast.
 * ──────────────────────────────────────────────────────────────────────── */

const RETURN_PATH = '/checkout/return';

export function CheckoutPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { cart, totalPrice, isLoading, isError } = useCart();
  const navigate = useNavigate();
  const openCartDrawer = useUiStore((s) => s.openCartDrawer);

  const [gateway, setGateway] = useState<CheckoutGateway>('vnpay');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const shippingFormRef = useRef<ShippingFormHandle>(null);

  /* ── Derived ─────────────────────────────────────────────────────────── */

  const items = cart?.items ?? [];
  const subtotal = totalPrice;
  const shipping = useMemo(() => deriveShippingFee(subtotal), [subtotal]);
  const total = subtotal + shipping;

  /**
   * Build absolute return/cancel URLs that include the paymentId so the
   * PaymentReturnPage can verify without an extra lookup. The gateway
   * echoes the return URL back to the browser after the user finishes.
   */
  const buildReturnUrls = (paymentId: string) => {
    const origin = window.location.origin;
    const tail = `?paymentId=${encodeURIComponent(paymentId)}`;
    return {
      returnUrl: `${origin}${RETURN_PATH}${tail}`,
      cancelUrl: `${origin}${RETURN_PATH}${tail}&status=cancelled`,
    };
  };

  /** Surface the backend's `message` field from a 400 / network error. */
  const formatError = (err: unknown): string => {
    const anyErr = err as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    return (
      anyErr?.response?.data?.message ??
      anyErr?.message ??
      'Checkout failed. Please try again.'
    );
  };

  const handleSubmit = async (values: ShippingFormValues) => {
    if (items.length === 0) {
      toast.error('Your cart is empty.');
      navigate('/cart', { replace: true });
      return;
    }

    setIsSubmitting(true);
    try {
      // 1) Create order(s) + Payment record(s). Use a placeholder URL
      //    for the first hop — the gateway will echo whichever URL we
      //    send on the *retry* call below.
      const provisionalUrls = buildReturnUrls('pending');
      const response: CheckoutResponse = await orderService.createOrder({
        shippingName: values.shippingName,
        shippingPhone: values.shippingPhone,
        shippingAddress: values.shippingAddress,
        note: values.note && values.note.length > 0 ? values.note : undefined,
        gateway,
        returnUrl: provisionalUrls.returnUrl,
        cancelUrl: provisionalUrls.cancelUrl,
      });

      // 2) Branch on gateway.
      if (gateway === 'vnpay') {
        const paymentId = response.paymentId;
        if (!paymentId) {
          throw new Error('Missing paymentId in checkout response');
        }

        // Re-issue the gateway session with the *real* paymentId in the
        // return URL so the PaymentReturnPage can verify on arrival.
        const urls = buildReturnUrls(paymentId);
        const retry = await paymentService.retry(paymentId, urls);
        if (!retry.paymentUrl) {
          throw new Error('Missing paymentUrl from gateway retry');
        }

        toast.success('Order created — redirecting to VNPay…');
        // Hard navigation to the sandbox URL.
        window.location.href = retry.paymentUrl;
        return;
      }

      // COD path — no gateway redirect, just confirm and head to /orders.
      toast.success('Order placed! Pay when your order arrives.');
      navigate('/orders', { replace: true });
    } catch (err) {
      const message = formatError(err);
      // Specific handling: inventory / stock issues get a clearer toast.
      const lower = message.toLowerCase();
      if (lower.includes('stock') || lower.includes('inventory')) {
        toast.error(message, {
          description:
            'Please head back to your cart to adjust quantities before trying again.',
        });
      } else if (lower.includes('cart')) {
        toast.error(message);
        navigate('/cart', { replace: true });
      } else {
        toast.error(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Render: auth gate ───────────────────────────────────────────────── */

  if (!isAuthenticated) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-brand-50 text-brand-700 mb-4">
          <LogIn size={22} aria-hidden />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Sign in to check out</h1>
        <p className="mt-2 text-sm text-slate-500">
          You'll need an account so we can save your orders and shipping details.
        </p>
        <Link
          to="/auth/login"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#002b5b] px-5 h-11 text-sm font-medium text-white hover:bg-[#001f3f] transition-colors"
        >
          Sign in
        </Link>
      </div>
    );
  }

  /* ── Render: loading ─────────────────────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-72 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
          <div className="lg:col-span-1">
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  /* ── Render: error / empty (redirect to /cart) ───────────────────────── */

  if (isError || items.length === 0) {
    return <Navigate to="/cart" replace />;
  }

  /* ── Render: checkout form ───────────────────────────────────────────── */

  const handlePlaceOrder = () => {
    shippingFormRef.current?.submit();
  };

  return (
    <>
      <PageMeta
        title="Checkout"
        description="Review your order, enter shipping details, and choose a payment method."
      />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Top breadcrumb-ish header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/cart')}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors mb-2"
          >
            <ChevronLeft size={12} aria-hidden />
            Back to cart
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Checkout
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review your shipping details, pick a payment method, and place your order.
          </p>
        </div>
        <button
          type="button"
          onClick={openCartDrawer}
          className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 h-10 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <ShoppingBag size={14} aria-hidden />
          View cart
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Left column: form + gateway picker ─────────────────────── */}
        <section className="lg:col-span-2 space-y-6">
          {/* Shipping form */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <header className="mb-5 flex items-center gap-2">
              <Truck size={16} className="text-[#002b5b]" aria-hidden />
              <h2 className="text-base font-semibold text-slate-900">
                Shipping details
              </h2>
            </header>
            <ShippingForm ref={shippingFormRef} onSubmit={handleSubmit} />
          </div>

          {/* Gateway picker */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <header className="mb-5 flex items-center gap-2">
              <Lock size={16} className="text-[#002b5b]" aria-hidden />
              <h2 className="text-base font-semibold text-slate-900">
                Payment method
              </h2>
            </header>
            <GatewaySelector value={gateway} onChange={setGateway} />

            <p className="mt-4 text-xs text-slate-500">
              {gateway === 'vnpay'
                ? "You'll be redirected to the VNPay sandbox to complete payment. Your order will be confirmed automatically once the payment succeeds."
                : 'Pay in cash when your order is delivered. Please keep the exact amount ready if possible.'}
            </p>
          </div>
        </section>

        {/* ── Right column: summary ─────────────────────────────────── */}
        <section className="lg:col-span-1">
          <OrderSummary
            items={items}
            subtotal={subtotal}
            action={
              <>
                <p className="mb-3 text-center text-xs text-slate-500">
                  By placing this order you agree to our terms of service.
                  {gateway === 'vnpay'
                    ? ` You'll be charged ${formatVND(total)}.`
                    : ` You'll pay ${formatVND(total)} on delivery.`}
                </p>
                <PlaceOrderButton
                  isLoading={isSubmitting}
                  onSubmit={handlePlaceOrder}
                  label={`Place order · ${formatVND(total)}`}
                  loadingLabel={
                    gateway === 'vnpay' ? 'Redirecting to VNPay…' : 'Placing order…'
                  }
                />
              </>
            }
          />
        </section>
      </div>
    </div>
    </>
  );
}
