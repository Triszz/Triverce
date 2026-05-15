import { Kysely, Transaction } from "kysely";
import { DatabaseSchema } from "../../infrastructure/database/db.schema";
import { PaymentRepository } from "../payment/payment.repository";
import { OrderRepository } from "../order/order.repository";
import { IPaymentGateway } from "../payment/payment.interface";
import { PaymentStatus } from "../payment/payment.entity";
import { OrderStatus } from "../order/order.entity";
import { BadRequestError } from "../../core/errors/AppError";

type DbOrTrx = Kysely<DatabaseSchema> | Transaction<DatabaseSchema>;

export class WebhookService {
  constructor(
    private paymentRepository: PaymentRepository,
    private orderRepository: OrderRepository,
    private gateway: IPaymentGateway,
  ) {}

  async handlePaymentWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<void> {
    // 1. Verify signature - throw if invalid
    const event = await this.gateway.verifyWebhook(rawBody, signature);

    // 2. Find payment by gatewayRef to get paymentId (MockAdapter has imported paymentId in event.paymentId)
    const { gatewayRef, paymentId, status, rawData } = event;

    // 3. Open a transaction to process all atomic data
    await this.paymentRepository.client.transaction().execute(async (trx) => {
      // 4. Idempotency guard - INSERT webhook event
      // If it has already been processed -> return immediately, do nothing further
      const isNew = await this.paymentRepository.saveWebhookEvent(
        {
          id: gatewayRef, // gateway event ID as PK
          gateway: "mock",
          eventType: `payment.${status}`, // change to 'momo' when production
          payload: rawData,
        },
        trx,
      );

      if (!isNew) return;

      // 5. Find payment
      const payment = await this.paymentRepository.findById(paymentId, trx);
      if (!payment)
        throw new BadRequestError(`Payment with id ${paymentId} not found`);

      // 6. Validate transition
      if (!payment.canTransitionTo(status)) {
        // Payment is in final status (paid/refunded) -> ignore, do not throw
        // Because the gateway can resend the webhook of the old event
        return;
      }

      // 7. Update payment status
      await this.paymentRepository.updateStatus(
        paymentId,
        status,
        {
          gatewayRef,
          gatewayData: rawData,
        },
        trx,
      );

      // 8. Update all related orders
      await this.updateRelatedOrders(paymentId, status, trx);
    });
  }

  async updateRelatedOrders(
    paymentId: string,
    paymentStatus: PaymentStatus,
    trx: DbOrTrx,
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

      await this.orderRepository.updateStatus(
        orderId,
        newStatus,
        undefined,
        trx,
      );

      await this.orderRepository.createStatusLog(
        {
          orderId,
          fromStatus: "pending",
          toStatus: newStatus,
          changedBy: null,
          note: `Auto updated via payment webhook (${paymentStatus})`,
        },
        trx,
      );
    }
  }
}
