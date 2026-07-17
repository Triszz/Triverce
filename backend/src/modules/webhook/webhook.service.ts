import type { PrismaClient } from "@prisma/client";
import { PaymentRepository } from "../payment/payment.repository";
import { OrderRepository } from "../order/order.repository";
import { IPaymentGateway } from "../payment/payment.interface";
import { PaymentStatus } from "../payment/payment.entity";
import { OrderStatus } from "../order/order.entity";
import { BadRequestError } from "../../core/errors/AppError";

/**
 * WebhookService — Prisma-aware.
 *
 * Public API unchanged.
 *
 * Uses `prisma.$transaction(async tx => …)` for the atomic webhook
 * processing flow. The helper `updateRelatedOrders` accepts the same
 * `Prisma.TransactionClient` that `tx` is, because the repository method
 * signatures already use `Prisma.TransactionClient` as their optional
 * `trx` parameter.
 */
export class WebhookService {
  constructor(
    private paymentRepository: PaymentRepository,
    private orderRepository: OrderRepository,
    private gateway: IPaymentGateway,
    private prisma: PrismaClient,
  ) {}

  async handlePaymentWebhook(
    gateway: "vnpay" | "momo",
    rawBody: Buffer,
    signature: string,
  ): Promise<void> {
    const event = await this.gateway.verifyWebhook(rawBody, signature);
    const { gatewayRef, paymentId, status, rawData } = event;

    await this.prisma.$transaction(async (trx) => {
      // Idempotency guard — INSERT webhook event, skip rest if already seen.
      const isNew = await this.paymentRepository.saveWebhookEvent(
        {
          id: gatewayRef,
          gateway,
          eventType: `payment.${status}`,
          payload: rawData,
        },
        trx,
      );
      if (!isNew) return;

      const payment = await this.paymentRepository.findById(paymentId, trx);
      if (!payment)
        throw new BadRequestError(`Payment with id "${paymentId}" not found`);

      // Idempotency: don't transition out of a final status.
      if (!payment.canTransitionTo(status)) return;

      await this.paymentRepository.updateStatus(
        paymentId,
        status,
        {
          gatewayRef,
          gatewayData: rawData,
        },
        trx,
      );

      await this.updateRelatedOrders(paymentId, status, trx);
    });
  }

  async updateRelatedOrders(
    paymentId: string,
    paymentStatus: PaymentStatus,
    trx: Parameters<PrismaClient["$transaction"]>[0] extends (tx: infer T) => unknown
      ? T
      : never,
  ): Promise<void> {
    const orderIds = await this.paymentRepository.loadOrderIds(paymentId, trx);

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

      // Idempotency guard (see OrderRepository.confirmOrderAfterPayment
      // and the matching comment in PaymentService.updateRelatedOrders):
      // if this webhook races with the browser-return URL, only one
      // caller's UPDATE matches the row's current status. The loser's
      // `applied` is false, and we skip the log insert so we don't get
      // two "Pending -> Confirmed" rows at the same timestamp.
      const applied = await this.orderRepository.confirmOrderAfterPayment(
        {
          orderId,
          expectedFromStatus: "pending",
          newStatus,
          note: `Auto updated via payment webhook (${paymentStatus})`,
          changedBy: null,
        },
        trx,
      );
      if (!applied) continue;
    }
  }
}
