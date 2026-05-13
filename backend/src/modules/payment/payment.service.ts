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

export class PaymentService {
  constructor(
    private paymentRepository: PaymentRepository,
    private gateway: IPaymentGateway,
    private orderRepository: OrderRepository,
  ) {}

  // Create payment session or retry
  async createPaymentSession(
    paymentId: string,
    customerId: string,
    dto: { returnUrl: string; cancelUrl: string },
  ): Promise<{ paymentUrl: string }> {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) throw new NotFoundError("Payment not found");

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
        this.paymentRepository.client,
      );

      return { paymentUrl: session.paymentUrl };
    } catch (error) {
      console.error("Payment gateway call error:", error);
      throw new BadRequestError(
        "Payment gateway connection error. Please try again later.",
      );
    }
  }

  // Verify status (Use when user redirect from MoMo)
  async verifyStatus(paymentId: string, customerId: string): Promise<any> {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) throw new NotFoundError("Payment not found");

    if (payment.customerId !== customerId)
      throw new ForbiddenError("Access denied");

    // Only contact MoMo to check if your database is still pending
    if (payment.status === "pending" && payment.gatewayRef) {
      const statusResult = await this.gateway.queryTransaction(
        payment.gatewayRef,
      );

      // If the status from MoMo is not pending (meaning the final result is available)
      if (statusResult.status !== "pending") {
        await this.paymentRepository.updateStatus(
          paymentId,
          statusResult.status, // Can be 'paid', 'failed', 'cancelled'
          {},
          this.paymentRepository.client,
        );

        payment.status = statusResult.status; // Update object to return for UI

        await this.updateRelatedOrders(
          paymentId,
          statusResult.status,
          this.paymentRepository.client,
        );
      }
    }

    return payment;
  }

  private async updateRelatedOrders(
    paymentId: string,
    paymentStatus: PaymentStatus,
    trx: any,
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
          break; // <- use 'failed' instead of 'cancelled'
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
          changedBy: "system",
          note: `Payment ${paymentStatus}`,
        },
        trx,
      );
    }
  }
}
