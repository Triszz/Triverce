import { useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ShoppingBag, LogIn, ChevronLeft, Lock } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCart } from '@/hooks/useCart';
import { useUiStore } from '@/stores/useUiStore';
import { orderService, type CheckoutResponse } from '@/services/orderService';
import { paymentService } from '@/services/paymentService';
import { GatewaySelector, type CheckoutGateway } from '@/features/checkout/GatewaySelector';
import {
  OrderSummary,
  PlaceOrderButton,
} from '@/features/checkout/OrderSummary';
import { PageMeta } from '@/components/common/PageMeta';
import {
  deriveShippingFee,
  formatVND,
} from '@/features/checkout/checkout.types';
import { AddressBook } from '@/features/address/components/AddressBook';
import { useAddresses } from '@/features/address/hooks/useAddresses';
import { useCreateAddress } from '@/features/address/hooks/useAddresses';
import type { ShippingFormValues } from '@/features/checkout/checkout.types';

/* ──────────────────────────────────────────────────────────────────────────
 * CheckoutPage — `/checkout`
 *
 * Flow:
 *   1. Auth gate → /auth/login if guest
 *   2. Cart gate → /cart if empty
 *   3. AddressBook (saved addresses + new address form)
 *      → "Use this address" confirms the selection into local state only
 *   4. "Place order" button (summary sidebar) →
 *        a. orderService.createOrder — creates order(s) + Payment(s).
 *           For VNPay the backend also calls the gateway to mint a URL.
 *        b. We rebuild the return/cancel URLs with the *real* paymentId
 *           and call paymentService.retry to get a fresh gateway URL.
 *        c. Redirect (VNPay) or navigate to /orders (COD).
 *
 * Key invariant: the checkout API call only fires from the "Place order"
 * button. Address selection is purely local state (confirmedValues).
 * ──────────────────────────────────────────────────────────────────────── */

const RETURN_PATH = '/checkout/return';

export function CheckoutPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { cart, totalPrice, isLoading: isCartLoading, isError } = useCart();
  const navigate = useNavigate();
  const openCartDrawer = useUiStore((s) => s.openCartDrawer);

  const [gateway, setGateway] = useState<CheckoutGateway>('vnpay');
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** Pre-filled values when the user has confirmed an address selection. */
  const [confirmedValues, setConfirmedValues] = useState<ShippingFormValues | null>(null);

  const { data: addresses = [], isLoading: isAddressesLoading } = useAddresses(isAuthenticated);
  const { mutateAsync: createAddress, isPending: isCreatingAddress } = useCreateAddress();

  /* ── Derived ─────────────────────────────────────────────────────────── */

  const items = cart?.items ?? [];
  const subtotal = totalPrice;
  const shipping = useMemo(() => deriveShippingFee(subtotal), [subtotal]);
  const total = subtotal + shipping;

  /* ── URL helpers ─────────────────────────────────────────────────────── */

  const buildReturnUrls = (paymentId: string) => {
    const origin = window.location.origin;
    const tail = `?paymentId=${encodeURIComponent(paymentId)}`;
    return {
      returnUrl: `${origin}${RETURN_PATH}${tail}`,
      cancelUrl: `${origin}${RETURN_PATH}${tail}&status=cancelled`,
    };
  };

  /* ── Error formatter ─────────────────────────────────────────────────── */

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

  /* ── Place order (final submission) ───────────────────────────────── */

  const placeOrder = async (values: ShippingFormValues) => {
    setIsSubmitting(true);
    try {
      // 1) Create order(s) + Payment record(s) with a placeholder URL.
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
        if (!paymentId) throw new Error('Missing paymentId in checkout response');

        // Re-issue the gateway session with the *real* paymentId in the return URL.
        const urls = buildReturnUrls(paymentId);
        const retry = await paymentService.retry(paymentId, urls);
        if (!retry.paymentUrl) {
          throw new Error('Missing paymentUrl from gateway retry');
        }

        toast.success('Order created — redirecting to VNPay…');
        window.location.href = retry.paymentUrl;
        return;
      }

      // COD path
      toast.success('Order placed! Pay when your order arrives.');
      navigate('/orders', { replace: true });
    } catch (err) {
      const message = formatError(err);
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

  /* ── Address selection handlers ──────────────────────────────────────── */

  /**
   * Confirms an address (saved or new) and stores it in local state.
   * Does NOT place the order — that only happens via `handlePlaceOrderClick`.
   */
  const handleAddressSelect = (values: ShippingFormValues) => {
    setConfirmedValues(values);
  };

  /**
   * Called by the AddressBook when the user clicks "Add new address".
   * Clears the confirmed address so the Place Order button is re-locked
   * until the new form is successfully submitted.
   */
  const handleAddNewAddress = () => {
    setConfirmedValues(null);
  };

  /**
   * Same as `handleAddressSelect` but first saves the address to the user's
   * address book before confirming it (for "Save + checkout" flows).
   * Does NOT place the order.
   */
  const handleSaveNewAndCheckout = async (values: ShippingFormValues) => {
    try {
      await createAddress({
        recipientName: values.shippingName,
        phone: values.shippingPhone,
        address: values.shippingAddress,
      });
      toast.success('Address saved to your address book.');
    } catch {
      // Non-fatal — still confirm and let the user retry saving manually.
      toast.error('Could not save address, but continuing…');
    }
    setConfirmedValues(values);
  };

  /** Called when the user clicks "Place order" in the summary sidebar. */
  const handlePlaceOrderClick = () => {
    if (!confirmedValues) return;
    void placeOrder(confirmedValues);
  };

  /* ── Render: auth gate ─────────────────────────────────────────────── */

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

  /* ── Render: loading ────────────────────────────────────────────────── */

  if (isCartLoading) {
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

  /* ── Render: error / empty ─────────────────────────────────────────── */

  if (isError || items.length === 0) {
    return <Navigate to="/cart" replace />;
  }

  /* ── Render: checkout form ─────────────────────────────────────────── */

  return (
    <>
      <PageMeta
        title="Checkout"
        description="Review your order, enter shipping details, and choose a payment method."
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Breadcrumb header */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => navigate('/cart')}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors mb-2 cursor-pointer"
            >
              <ChevronLeft size={12} aria-hidden />
              Back to cart
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Checkout</h1>
            <p className="text-sm text-slate-500 mt-1">
              Select a saved address or enter new shipping details.
            </p>
          </div>
          <button
            type="button"
            onClick={openCartDrawer}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 h-10 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ShoppingBag size={14} aria-hidden />
            View cart
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ── Left column: address book + gateway picker ────────────────── */}
          <section className="lg:col-span-2 space-y-6">
            {/* Address book */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
              <header className="mb-5 flex items-center gap-2">
                <span className="text-[#002b5b]" aria-hidden>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                </span>
                <h2 className="text-base font-semibold text-slate-900">
                  Shipping address
                </h2>
              </header>

              {isAddressesLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-xl" />
                  ))}
                </div>
              ) : (
                <AddressBook
                  addresses={addresses}
                  onSelect={handleAddressSelect}
                  onSaveNew={handleSaveNewAndCheckout}
                  isCreating={isCreatingAddress}
                  onAddNew={handleAddNewAddress}
                />
              )}
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
                  ? "You'll be redirected to VNPay to complete payment. Your order will be confirmed automatically once the payment succeeds."
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
                    disabled={!confirmedValues}
                    onSubmit={handlePlaceOrderClick}
                    label={`Place order · ${formatVND(total)}`}
                    loadingLabel={
                      gateway === 'vnpay' ? 'Redirecting to VNPay…' : 'Placing order…'
                    }
                  />
                  {!confirmedValues ? (
                    <p className="mt-2 text-center text-xs text-slate-500">
                      Select a shipping address above to continue.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmedValues(null)}
                      className="mt-2 w-full text-center text-xs font-medium text-[#002b5b] hover:text-[#001f3f] underline-offset-2 hover:underline transition-colors cursor-pointer"
                    >
                      Change address
                    </button>
                  )}
                </>
              }
            />
          </section>
        </div>
      </div>
    </>
  );
}
