import {
  CreateSessionParams,
  GatewaySession,
  GatewayEvent,
  GatewayTransactionStatus,
  RefundParams,
  GatewayRefundResult,
  PaymentGatewayName,
} from "./payment.types";

export interface IPaymentGateway {
  /** Stable identifier for the concrete adapter (e.g. "vnpay", "momo"). */
  readonly gatewayName: PaymentGatewayName;
  createSession(params: CreateSessionParams): Promise<GatewaySession>;
  verifyWebhook(rawBody: Buffer, signature: string): Promise<GatewayEvent>;
  /**
   * Convenience helper for verifying a parsed key/value payload — useful
   * for browser-return handlers that already received the params via JSON.
   * Default impl re-uses verifyWebhook by re-serialising.
   */
  verifyReturnParams?(params: Record<string, string>): {
    valid: boolean;
    status: "paid" | "failed" | "cancelled";
    paymentId: string | null;
  };
  queryTransaction(gatewayRef: string): Promise<GatewayTransactionStatus>;
  refundTransaction(params: RefundParams): Promise<GatewayRefundResult>;
}
