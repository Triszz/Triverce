import axios from "axios";
import * as crypto from "crypto";
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

export interface MoMoConfig {
  partnerCode: string;
  accessKey: string;
  secretKey: string;
  apiUrl: string; // https://test-payment.momo.vn (sandbox)
  ipnUrl: string; // URL receive webhook (IPN)
}

export class MoMoAdapter implements IPaymentGateway {
  constructor(private config: MoMoConfig) {}

  // Create payment session
  async createSession(params: CreateSessionParams): Promise<GatewaySession> {
    const requestId = params.paymentId; // use paymentId as requestId -> idempotency
    const orderId = params.paymentId; // MoMo use orderId to identify session idempotency

    const rawSignature = [
      `accessKey=${this.config.accessKey}`,
      `amount=${params.amount}`,
      `extraData=${params.paymentId}`, // import paymentId to parse again in webhook
      `ipnUrl=${this.config.ipnUrl}`,
      `orderId=${orderId}`,
      `orderInfo=${params.description ?? "Pay for the order"}`,
      `partnerCode=${this.config.partnerCode}`,
      `redirectUrl=${params.returnUrl}`,
      `requestId=${requestId}`,
      `requestType=payWithMethod`,
    ].join("&");

    const signature = this.sign(rawSignature);

    const body = {
      partnerCode: this.config.partnerCode,
      accessKey: this.config.accessKey,
      requestId,
      amount: params.amount,
      orderId,
      orderInfo: params.description ?? "Pay for the order",
      redirectUrl: params.returnUrl,
      ipnUrl: this.config.ipnUrl,
      extraData: params.paymentId, // <- parse again in verifyWebhook
      requestType: "payWithMethod",
      signature,
      lang: "vi",
    };
    const response = await axios.post(
      `${this.config.apiUrl}/v2/gateway/api/create`,
      body,
    );

    const data = response.data;
    if (data.resultCode !== 0) {
      throw new BadRequestError(
        `MoMo error: ${data.message} (code ${data.resultCode})`,
      );
    }

    return {
      gatewayRef: data.requestId,
      paymentUrl: data.payUrl,
    };
  }

  // Verify webhook IPN from MoMo
  async verifyWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<GatewayEvent> {
    const payload = JSON.parse(rawBody.toString()) as Record<string, unknown>;

    // 1. Reconstruct signature to verify
    const rawSignature = [
      `accessKey=${this.config.accessKey}`,
      `amount=${payload.amount}`,
      `extraData=${payload.extraData}`,
      `message=${payload.message}`,
      `orderId=${payload.orderId}`,
      `orderInfo=${payload.orderInfo}`,
      `orderType=${payload.orderType}`,
      `partnerCode=${payload.partnerCode}`,
      `payType=${payload.payType}`,
      `requestId=${payload.requestId}`,
      `responseTime=${payload.responseTime}`,
      `resultCode=${payload.resultCode}`,
      `transId=${payload.transId}`,
    ].join("&");

    const expected = this.sign(rawSignature);
    if (expected !== signature) {
      throw new BadRequestError("Invalid MoMo webhook signature");
    }

    // 2. Map resultCode -> status
    const resultCode = payload.resultCode as number;
    const status =
      resultCode === 0 ? "paid" : resultCode === 1006 ? "cancelled" : "failed";

    return {
      gatewayRef: String(payload.transId),
      paymentId: String(payload.extraData), // ← paymentId import when createSession
      status,
      rawData: payload,
    };
  }

  // Query transaction status directly
  async queryTransaction(
    gatewayRef: string,
  ): Promise<GatewayTransactionStatus> {
    const requestId = crypto.randomUUID();
    const rawSignature = [
      `accessKey=${this.config.accessKey}`,
      `orderId=${gatewayRef}`,
      `partnerCode=${this.config.partnerCode}`,
      `requestId=${requestId}`,
    ].join("&");

    const body = {
      partnerCode: this.config.partnerCode,
      requestId,
      orderId: gatewayRef,
      signature: this.sign(rawSignature),
      lang: "vi",
    };

    const response = await axios.post(
      `${this.config.apiUrl}/v2/gateway/api/query`,
      body,
    );

    const data = response.data;
    const resultCode = data.resultCode as number;
    const status =
      resultCode === 0
        ? "paid"
        : resultCode === 1000
          ? "pending"
          : resultCode === 1006
            ? "cancelled"
            : "failed";

    return { gatewayRef, status };
  }

  // Refund
  async refundTransaction(params: RefundParams): Promise<GatewayRefundResult> {
    const requestId = crypto.randomUUID();
    const rawSignature = [
      `accessKey=${this.config.accessKey}`,
      `amount=${params.amount}`,
      `description=${params.reason ?? ""}`,
      `orderId=${requestId}`,
      `partnerCode=${this.config.partnerCode}`,
      `requestId=${requestId}`,
      `transId=${params.gatewayRef}`,
    ].join("&");

    const body = {
      partnerCode: this.config.partnerCode,
      requestId,
      amount: params.amount,
      transId: params.gatewayRef,
      orderId: requestId,
      description: params.reason ?? "",
      signature: this.sign(rawSignature),
      lang: "vi",
    };

    const response = await axios.post(
      `${this.config.apiUrl}/v2/gateway/api/refund`,
      body,
    );

    const data = response.data;
    const status =
      data.resultCode === 0
        ? "success"
        : data.resultCode === 1000
          ? "pending"
          : "failed";

    return {
      status,
      refundRef: String(data.transId ?? requestId),
    };
  }

  // HMAC SHA256 helper
  private sign(data: string): string {
    return crypto
      .createHmac("sha256", this.config.secretKey)
      .update(data)
      .digest("hex");
  }
}
