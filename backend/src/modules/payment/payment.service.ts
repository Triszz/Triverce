import type { PrismaClient, Prisma } from "@prisma/client";
import { PaymentRepository } from "./payment.repository";
import { OrderRepository } from "../order/order.repository";
import { IPaymentGateway } from "./payment.interface";
import { OrderStatus } from "../order/order.entity";
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from "../../core/errors/AppError";
import { PaymentStatus } from "./payment.entity";

/**
 * PaymentService — Prisma-aware.
 *
 * Public API unchanged.
 *
 * The service no longer holds a Kysely client. The single service-level
 * transaction (confirmCOD) now uses `prisma.$transaction(async tx => …)`.
 * Standalone writes (setGatewayRef, updateStatus) pass `this.prisma`
 * directly.
 */
export class PaymentService {
  constructor(
    private paymentRepository: PaymentRepository,
    private gateway: IPaymentGateway,
    private orderRepository: OrderRepository,
    private prisma: PrismaClient,
  ) {}

  async createPaymentSession(
    paymentId: string,
    customerId: string,
    dto: { returnUrl: string; cancelUrl: string },
  ): Promise<{ paymentUrl: string }> {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment)
      throw new NotFoundError(`Payment with id "${paymentId}"not found`);

    if (payment.customerId !== customerId)
      throw new ForbiddenError("Access denied");

    if (payment.status !== "pending") {
      throw new BadRequestError(
        `Payment is already in "${payment.status}" status`,
      );
    }

    try {
      const session = await this.gateway.createSession({
        paymentId: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        returnUrl: dto.returnUrl,
        cancelUrl: dto.cancelUrl,
        description: `Thanh toan don hang`,
      });

      await this.paymentRepository.setGatewayRef(
        payment.id,
        session.gatewayRef,
        this.prisma,
      );

      return { paymentUrl: session.paymentUrl };
    } catch (error) {
      console.error("Payment gateway call error:", error);
      throw new BadRequestError(
        "Payment gateway connection error. Please try again later.",
      );
    }
  }

  async verifyStatus(paymentId: string, customerId: string): Promise<unknown> {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) throw new NotFoundError("Payment not found");

    if (payment.customerId !== customerId)
      throw new ForbiddenError("Access denied");

    if (payment.gateway === "cod") {
      return payment.toPublic();
    }

    if (payment.status === "pending" && payment.gatewayRef) {
      const statusResult = await this.gateway.queryTransaction(
        payment.gatewayRef,
      );

      if (statusResult.status !== "pending") {
        await this.paymentRepository.updateStatus(
          paymentId,
          statusResult.status,
          {},
          this.prisma,
        );

        payment.status = statusResult.status;

        await this.updateRelatedOrders(
          paymentId,
          statusResult.status,
          this.prisma,
        );
      }
    }

    return payment.toPublic();
  }

  async confirmCOD(paymentId: string, sellerId: string): Promise<void> {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) throw new NotFoundError("Payment not found");

    if (payment.gateway !== "cod")
      throw new BadRequestError("Not a COD payment");
    if (payment.status !== "pending") return;

    const orderIds = await this.paymentRepository.loadOrderIds(paymentId);
    const order = await this.orderRepository.findById(orderIds[0]);

    if (order?.sellerId !== sellerId) {
      throw new ForbiddenError(
        "You don't have permission to confirm this payment",
      );
    }

    await this.prisma.$transaction(async (trx) => {
      await this.paymentRepository.updateStatus(
        paymentId,
        "paid",
        {
          gatewayData: {
            confirmedBy: sellerId,
            confirmedAt: new Date().toISOString(),
          },
        },
        trx,
      );

      await this.updateRelatedOrders(paymentId, "paid", trx);
    });
  }

  /**
   * Handle the VNPay browser return-URL callback.
   *
   * The frontend's PaymentReturnPage posts the raw query params it got
   * from VNPay here so we can:
   *   1. Verify the HMAC SHA512 signature.
   *   2. Read vnp_ResponseCode / vnp_TransactionStatus.
   *   3. Flip the payment to `paid` (or `failed` / `cancelled`) and
   *      cascade to the related orders.
   *
   * Idempotent: if the payment is already in a terminal state we skip
   * the cascade.
   */
  async handleVnpayReturn(
    paymentId: string,
    customerId: string,
    params: Record<string, string>,
  ): Promise<{ status: PaymentStatus; valid: boolean }> {
    if (this.gateway.gatewayName !== "vnpay") {
      throw new BadRequestError(
        "Active payment gateway is not VNPay — return handler unavailable",
      );
    }

    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment)
      throw new NotFoundError(`Payment with id "${paymentId}" not found`);
    if (payment.customerId !== customerId)
      throw new ForbiddenError("Access denied");
    if (payment.gateway !== "vnpay") {
      throw new BadRequestError(
        `Payment "${paymentId}" is not a VNPay payment (gateway=${payment.gateway})`,
      );
    }

    // Already terminal? Nothing to do, but report the canonical status.
    if (payment.status !== "pending") {
      return { status: payment.status, valid: true };
    }

    // `verifyReturnParams` is optional on the interface; the concrete
    // VNPay adapter always implements it, but we type-guard for the
    // case where someone wires in a gateway that doesn't.
    if (typeof this.gateway.verifyReturnParams !== "function") {
      throw new BadRequestError(
        "Active payment gateway does not support browser-return verification",
      );
    }
    const verdict = this.gateway.verifyReturnParams(params);
    if (!verdict.valid) {
      // Reject the callback outright — don't trust unsigned payloads.
      throw new BadRequestError("Invalid VNPay signature");
    }

    await this.prisma.$transaction(async (trx) => {
      await this.paymentRepository.updateStatus(
        paymentId,
        verdict.status,
        {
          gatewayData: {
            vnp_TxnRef: params.vnp_TxnRef,
            vnp_TransactionNo: params.vnp_TransactionNo,
            vnp_ResponseCode: params.vnp_ResponseCode,
            vnp_TransactionStatus: params.vnp_TransactionStatus,
            vnp_Amount: params.vnp_Amount,
            vnp_BankCode: params.vnp_BankCode,
            vnp_PayDate: params.vnp_PayDate,
            raw: params,
          },
        },
        trx,
      );

      await this.updateRelatedOrders(paymentId, verdict.status, trx);
    });

    return { status: verdict.status, valid: true };
  }

  private async updateRelatedOrders(
    paymentId: string,
    paymentStatus: PaymentStatus,
    client: PrismaClient | Prisma.TransactionClient,
  ): Promise<void> {
    const orderIds = await this.paymentRepository.loadOrderIds(
      paymentId,
      client,
    );

    for (const orderId of orderIds) {
      let newStatus: OrderStatus;

      switch (paymentStatus) {
        case "paid":
          newStatus = "confirmed";
          break;
        case "failed":
        case "cancelled":
          newStatus = "failed";
          break;
        default:
          newStatus = "pending";
      }

      await this.orderRepository.updateStatus(
        orderId,
        newStatus,
        undefined,
        client,
      );

      await this.orderRepository.createStatusLog(
        {
          orderId,
          fromStatus: "pending",
          toStatus: newStatus,
          changedBy: null,
          note: `Payment ${paymentStatus}`,
        },
        client,
      );
    }
  }
}
