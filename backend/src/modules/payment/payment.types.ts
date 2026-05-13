export interface CreateSessionParams {
  paymentId: string; // idempotency key, import in extraData of MoMo
  amount: number;
  currency: string;
  returnUrl: string; // redirect after successfully paid
  cancelUrl: string; // redirect if user cancel
  description?: string;
}

export interface GatewaySession {
  gatewayRef: string; // MoMo requestId
  paymentUrl: string; // URL redirect for client
}

export interface GatewayEvent {
  gatewayRef: string; // MoMo transId
  paymentId: string; // parse from extraData - don't need to query DB
  status: "paid" | "failed" | "cancelled";
  rawData: Record<string, unknown>;
}

export interface GatewayTransactionStatus {
  gatewayRef: string;
  status: "paid" | "failed" | "pending" | "cancelled";
}

export interface RefundParams {
  gatewayRef: string; // original MoMo transId
  amount: number;
  reason?: string;
}

export interface GatewayRefundResult {
  status: "success" | "failed" | "pending";
  refundRef: string;
}
