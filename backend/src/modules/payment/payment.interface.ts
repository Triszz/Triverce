import {
  CreateSessionParams,
  GatewaySession,
  GatewayEvent,
  GatewayTransactionStatus,
  RefundParams,
  GatewayRefundResult,
} from "./payment.types";

export interface IPaymentGateway {
  createSession(params: CreateSessionParams): Promise<GatewaySession>;
  verifyWebhook(rawBody: Buffer, signature: string): Promise<GatewayEvent>;
  queryTransaction(gatewayRef: string): Promise<GatewayTransactionStatus>;
  refundTransaction(params: RefundParams): Promise<GatewayRefundResult>;
}
