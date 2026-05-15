import { IPaymentGateway } from "../payment.interface";
import {
  CreateSessionParams,
  GatewayEvent,
  GatewayRefundResult,
  GatewaySession,
  GatewayTransactionStatus,
  RefundParams,
} from "../payment.types";

export class MockPaymentAdapter implements IPaymentGateway {
  async createSession(params: CreateSessionParams): Promise<GatewaySession> {
    // Returns a fake URL — frontend redirects here for "payment"
    return {
      gatewayRef: `mock_ref_${params.paymentId}`,
      paymentUrl: `http://localhost:3000/mock-payment?paymentId=${params.paymentId}`,
    };
  }

  async verifyWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<GatewayEvent> {
    // Mock does not verify signature
    const payload = JSON.parse(rawBody.toString()) as Record<string, unknown>;
    return {
      gatewayRef: String(payload.gatewayRef),
      paymentId: String(payload.paymentId),
      status: payload.status as "paid" | "failed" | "cancelled",
      rawData: payload,
    };
  }

  async queryTransaction(
    gatewayRef: string,
  ): Promise<GatewayTransactionStatus> {
    // Always return "paid" for easier testing
    return {
      gatewayRef,
      status: "paid",
    };
  }

  async refundTransaction(params: RefundParams): Promise<GatewayRefundResult> {
    return {
      status: "success",
      refundRef: `mock_refund_${params.gatewayRef}`,
    };
  }
}
