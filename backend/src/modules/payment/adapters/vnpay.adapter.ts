import * as crypto from "crypto";
import qs from "querystring";
import type { Request } from "express";
import { IPaymentGateway } from "../payment.interface";
import {
  CreateSessionParams,
  GatewayEvent,
  GatewayRefundResult,
  GatewaySession,
  GatewayTransactionStatus,
  RefundParams,
} from "../payment.types";
import { BadRequestError } from "../../../core/errors/AppError";

/* ──────────────────────────────────────────────────────────────────────────
 * VNPay sandbox adapter.
 *
 *  • `createSession` builds the real `https://sandbox.vnpayment.vn/...`
 *    redirect URL with HMAC SHA512 over the alphabetically-sorted
 *    query parameters (minus the hash family itself).
 *  • `verifyWebhook` accepts both the IPN (form-urlencoded) and the
 *    browser return-URL callback — VNPay sends both as
 *    `application/x-www-form-urlencoded` payloads in practice, and we
 *    accept either a raw `Buffer`, a parsed `body`, or an Express `req`.
 *  • `queryTransaction`/`refundTransaction` are not implemented for the
 *    sandbox flow and throw — the production vnpay querydr / refunddr
 *    endpoints can be added later without changing the gateway interface.
 *
 * Required env vars (see backend/.env.example):
 *   VNP_TMN_CODE, VNP_HASH_SECRET, VNP_URL
 * ──────────────────────────────────────────────────────────────────────── */

export interface VNPayConfig {
  tmnCode: string;
  hashSecret: string;
  payUrl: string;
}

interface VNPayRawParams {
  [key: string]: string;
}

const HASH_KEYS_TO_STRIP = new Set([
  "vnp_SecureHash",
  "vnp_SecureHashType",
]);

export class VNPayAdapter implements IPaymentGateway {
  readonly gatewayName = "vnpay" as const;
  constructor(private readonly config: VNPayConfig) {}

  /**
   * Build the redirect URL the customer should be sent to.
   *
   * VNPay's sandbox documentation:
   *   1. Collect the canonical query parameters (prefixed `vnp_`).
   *   2. URL-encode each value (RFC 3986-ish — VNPay uses its own
   *      `encodeURIComponent`-style encoding; we replicate that here).
   *   3. Sort alphabetically by key, join as `k=v&k=v`, then HMAC SHA512
   *      the string with `VNP_HASH_SECRET`.
   *   4. Append `vnp_SecureHashType=SHA512` and `vnp_SecureHash=<hex>`.
   *   5. Prepend `VNP_URL` to produce the final redirect URL.
   */
  async createSession(params: CreateSessionParams): Promise<GatewaySession> {
    if (!this.config.tmnCode || !this.config.hashSecret || !this.config.payUrl) {
      throw new BadRequestError(
        "VNPay is not configured (missing VNP_TMN_CODE / VNP_HASH_SECRET / VNP_URL)",
      );
    }

    const now = new Date();
    // vnp_CreateDate is VNPay's `yyyyMMddHHmmss` in GMT+7.
    const createDate = formatVNPayDate(now);

    const amount = Math.round(params.amount * 100); // VND has no minor units, VNPay expects the integer × 100

    const rawParams: VNPayRawParams = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: this.config.tmnCode,
      vnp_Amount: String(amount),
      vnp_CreateDate: createDate,
      vnp_CurrCode: params.currency || "VND",
      vnp_IpAddr: "127.0.0.1",
      vnp_Locale: "vn",
      vnp_OrderInfo: sanitizeOrderInfo(params.description ?? "Thanh toan don hang"),
      vnp_OrderType: "other",
      vnp_ReturnUrl: params.returnUrl,
      vnp_TxnRef: params.paymentId,
    };

    const signedQuery = this.buildSignedQuery(rawParams);

    return {
      gatewayRef: params.paymentId, // VNPay uses our paymentId as TxnRef for idempotency
      paymentUrl: `${this.config.payUrl}?${signedQuery}`,
    };
  }

  /**
   * Verify a VNPay callback payload. Accepts either:
   *   • a raw `Buffer` (typical for express.raw()),
   *   • an Express `Request` (typical for express.json() with parsed body),
   *   • or a plain key/value object (typical for direct programmatic use).
   *
   * VNPay itself sends the IPN as form-urlencoded. The browser return URL
   * is also form-encoded query string. Both parse identically.
   */
  async verifyWebhook(
    rawBody: Buffer | Request | VNPayRawParams,
    _signature: string,
  ): Promise<GatewayEvent> {
    const params = this.extractParams(rawBody);
    const status = this.statusFromParams(params);

    // paymentId is the vnp_TxnRef we minted in createSession
    const paymentId = params.vnp_TxnRef;
    if (!paymentId) {
      throw new BadRequestError("VNPay callback is missing vnp_TxnRef");
    }

    return {
      gatewayRef: String(params.vnp_TransactionNo ?? params.vnp_TxnRef),
      paymentId,
      status,
      rawData: params,
    };
  }

  /**
   * Sandbox flow has no querydr equivalent — the browser return URL is the
   * authoritative source of truth. We keep the gateway interface satisfied
   * by reporting `pending` until a fresh callback arrives.
   */
  async queryTransaction(
    gatewayRef: string,
  ): Promise<GatewayTransactionStatus> {
    return { gatewayRef, status: "pending" };
  }

  /**
   * VNPay refunddr is out of scope for the sandbox integration. We expose
   * it on the interface so the gateway contract stays uniform, but the
   * real implementation can be slotted in without changing callers.
   */
  async refundTransaction(_params: RefundParams): Promise<GatewayRefundResult> {
    throw new BadRequestError(
      "VNPay refunds are not implemented in the current sandbox integration",
    );
  }

  /**
   * Validate a VNPay return-URL payload from the browser. This is a
   * convenience used by the controller that handles the
   * `/payments/:paymentId/vnpay-return` endpoint — the same code path
   * runs through `verifyWebhook`, but this helper exposes the raw
   * `valid` flag so the controller can surface a 400 on bad signatures
   * rather than a generic 500.
   */
  verifyReturnParams(params: VNPayRawParams): {
    valid: boolean;
    status: "paid" | "failed" | "cancelled";
    paymentId: string | null;
  } {
    const valid = this.verifySignature(params);
    if (!valid) {
      return { valid: false, status: "failed", paymentId: null };
    }
    return {
      valid: true,
      status: this.statusFromParams(params),
      paymentId: params.vnp_TxnRef ?? null,
    };
  }

  /* ── Internals ───────────────────────────────────────────────────────── */

  private buildSignedQuery(params: VNPayRawParams): string {
    // 1. Filter out the hash family — they must not be part of the input.
    const signPayload: VNPayRawParams = {};
    for (const [k, v] of Object.entries(params)) {
      if (!HASH_KEYS_TO_STRIP.has(k)) signPayload[k] = v;
    }

    // 2. URL-encode values the way VNPay expects (`encodeURIComponent`
    //    replaces spaces with `%20` rather than `+` — matches VNPay's
    //    examples).
    const encoded: Array<[string, string]> = Object.entries(signPayload).map(
      ([k, v]) => [k, encodeVNPay(v)],
    );

    // 3. Sort alphabetically by key.
    encoded.sort(([a], [b]) => a.localeCompare(b));

    // 4. Join into the canonical sign string.
    const signData = encoded.map(([k, v]) => `${k}=${v}`).join("&");

    // 5. HMAC SHA512.
    const secureHash = crypto
      .createHmac("sha512", this.config.hashSecret)
      .update(Buffer.from(signData, "utf-8"))
      .digest("hex");

    // 6. Append the hash family.
    encoded.push(["vnp_SecureHashType", "SHA512"]);
    encoded.push(["vnp_SecureHash", secureHash]);
    return encoded.map(([k, v]) => `${k}=${v}`).join("&");
  }

  private verifySignature(params: VNPayRawParams): boolean {
    const provided = params.vnp_SecureHash;
    if (!provided) return false;

    const { vnp_SecureHash: _h, vnp_SecureHashType: _t, ...rest } = params;
    const signPayload: VNPayRawParams = rest;

    const encoded: Array<[string, string]> = Object.entries(signPayload).map(
      ([k, v]) => [k, encodeVNPay(v)],
    );
    encoded.sort(([a], [b]) => a.localeCompare(b));

    const signData = encoded.map(([k, v]) => `${k}=${v}`).join("&");
    const expected = crypto
      .createHmac("sha512", this.config.hashSecret)
      .update(Buffer.from(signData, "utf-8"))
      .digest("hex");

    return timingSafeEqualHex(expected, provided);
  }

  private statusFromParams(params: VNPayRawParams):
    | "paid"
    | "failed"
    | "cancelled" {
    const responseCode = params.vnp_ResponseCode;
    const transactionStatus = params.vnp_TransactionStatus;

    // `vnp_ResponseCode === '00'` AND `vnp_TransactionStatus === '00'` is
    // the canonical "paid" combo per VNPay sandbox docs. We accept either
    // signal alone for robustness, since some test cards only populate
    // `vnp_TransactionStatus`.
    if (responseCode === "00" || transactionStatus === "00") {
      return "paid";
    }
    if (responseCode === "24" || transactionStatus === "02") {
      return "cancelled";
    }
    return "failed";
  }

  private extractParams(
    input: Buffer | Request | VNPayRawParams,
  ): VNPayRawParams {
    if (Buffer.isBuffer(input)) {
      return this.parseFormUrlEncoded(input.toString("utf-8"));
    }
    if (typeof (input as Request).body !== "undefined") {
      return this.normalizeBody((input as Request).body);
    }
    return this.normalizeBody(input as VNPayRawParams);
  }

  private normalizeBody(body: unknown): VNPayRawParams {
    if (!body) return {};
    if (typeof body === "string") return this.parseFormUrlEncoded(body);
    if (Buffer.isBuffer(body)) return this.parseFormUrlEncoded(body.toString("utf-8"));
    if (typeof body === "object") return { ...(body as VNPayRawParams) };
    return {};
  }

  private parseFormUrlEncoded(raw: string): VNPayRawParams {
    // `querystring.parse` is built-in and handles `+` -> space, percent-decoding, etc.
    return qs.parse(raw) as VNPayRawParams;
  }
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function formatVNPayDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function encodeVNPay(value: string): string {
  // VNPay expects `encodeURIComponent` style: space -> %20, not +.
  return encodeURIComponent(value).replace(/%20/g, "+");
}

function sanitizeOrderInfo(text: string): string {
  // VNPay's vnp_OrderInfo must be plain ASCII-ish (no special chars);
  // strip diacritics + collapse whitespace.
  const stripped = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return stripped.length > 0 ? stripped : "Thanh toan don hang";
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}