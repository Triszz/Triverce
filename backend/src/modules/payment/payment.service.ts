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
