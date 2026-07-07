import apiClient from './apiClient';

/* ──────────────────────────────────────────────────────────────────────────
 * Payment service — wraps the `/payments/:id/*` endpoints.
 *
 * The customer-facing surface is small:
 *   • verify(paymentId)        — poll for terminal status after gateway redirect
 *   • retry(paymentId, urls)   — regenerate a gateway session for an
 *                                existing pending payment (e.g. VNPay link expired)
 *
 * Note: the backend uses `POST /payments/:paymentId/retry` and accepts
 * `{ returnUrl, cancelUrl }` in the body (see payment.controller.ts).
 * ──────────────────────────────────────────────────────────────────────── */

/** Public shape of a payment (mirrors `PaymentEntity.toPublic()`). */
export interface PaymentPublic {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'refunded';
  gateway: 'momo' | 'stripe' | 'vnpay' | 'cod';
  orderIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** Payload accepted by `POST /payments/:paymentId/retry`. */
export interface RetryPaymentPayload {
  returnUrl: string;
  cancelUrl: string;
}

/** Response shape of `POST /payments/:paymentId/retry`. */
export interface RetryPaymentResponse {
  paymentUrl: string;
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

function unwrap<T>(payload: ApiSuccess<T>): T {
  if (!payload.success) throw new Error('Payment request failed');
  return payload.data;
}

export const paymentService = {
  /**
   * GET /payments/:paymentId/verify
   *
   * The backend's `verifyStatus` does the heavy lifting:
   *   • For COD it returns the payment record immediately.
   *   • For gateway payments it queries the gateway if the record is still
   *     `pending` with a `gatewayRef`, and updates the local status when
   *     the gateway reports a terminal state.
   *
   * Returns the public payment record. The caller is responsible for
   * deciding when to stop polling (we use a 5-try × 1.5s budget).
   */
  verify: async (paymentId: string): Promise<PaymentPublic> => {
    const { data } = await apiClient.get<ApiSuccess<PaymentPublic>>(
      `/payments/${encodeURIComponent(paymentId)}/verify`,
    );
    return unwrap(data);
  },

  /**
   * POST /payments/:paymentId/retry
   *
   * Re-creates a gateway session for a pending payment whose initial
   * paymentUrl has expired (or was never opened). Returns the fresh URL.
   */
  retry: async (
    paymentId: string,
    payload: RetryPaymentPayload,
  ): Promise<RetryPaymentResponse> => {
    const { data } = await apiClient.post<ApiSuccess<RetryPaymentResponse>>(
      `/payments/${encodeURIComponent(paymentId)}/retry`,
      payload,
    );
    return unwrap(data);
  },

  /**
   * POST /payments/:paymentId/vnpay-return
   *
   * The frontend lands here after the user finishes (or aborts) payment
   * on the VNPay sandbox. We re-post the raw `vnp_*` query string back
   * to the backend so it can verify the HMAC SHA512 signature and flip
   * the payment status. After this call the verify() polling will pick
   * up the new status on the next tick.
   */
  submitVnpayReturn: async (
    paymentId: string,
    params: Record<string, string>,
  ): Promise<{ valid: boolean; status: PaymentPublic['status'] }> => {
    const { data } = await apiClient.post<
      ApiSuccess<{ valid: boolean; status: PaymentPublic['status'] }>
    >(
      `/payments/${encodeURIComponent(paymentId)}/vnpay-return`,
      params,
    );
    return unwrap(data);
  },
};

/* ──────────────────────────────────────────────────────────────────────────
 * Polling helper
 *
 * Wraps `paymentService.verify` with a bounded retry loop. The payment
 * gateway webhooks can lag a few seconds behind the user redirect, so we
 * poll a handful of times with a fixed delay and stop as soon as the
 * status leaves `pending` (in either direction).
 *
 * Resolves with the last verified PaymentPublic so the caller can inspect
 * the final status. Throws on network errors but NOT on `failed` status —
 * callers decide how to render failures.
 * ──────────────────────────────────────────────────────────────────────── */

export interface PollOptions {
  /** Max number of attempts (default 5). */
  maxAttempts?: number;
  /** Delay between attempts in ms (default 1500). */
  delayMs?: number;
  /** Optional cancellation signal — aborts the loop early. */
  signal?: AbortSignal;
}

export async function pollPaymentStatus(
  paymentId: string,
  options: PollOptions = {},
): Promise<PaymentPublic> {
  const { maxAttempts = 5, delayMs = 1500, signal } = options;

  let last: PaymentPublic | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) break;
    last = await paymentService.verify(paymentId);
    if (last.status !== 'pending') return last;
    if (attempt < maxAttempts) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delayMs);
        signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Polling aborted', 'AbortError'));
        });
      });
    }
  }
  // After maxAttempts the status was still pending — return the last reading.
  return last as PaymentPublic;
}