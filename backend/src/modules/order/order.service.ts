import type { PrismaClient, Prisma } from "@prisma/client";
import { OrderRepository } from "./order.repository";
import { OrderEntity } from "./order.entity";
import {
  CreateOrderDto,
  UpdateOrderStatusDto,
  CancelOrderDto,
} from "./order.dto";
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from "../../core/errors/AppError";
import { CartRepository } from "../cart/cart.repository";
import { PaymentRepository } from "../payment/payment.repository";
import type { IPaymentGateway } from "../payment/payment.interface";
import type { INotificationService } from "../../core/interfaces/INotificationService";

/**
 * OrderService — Prisma-aware.
 *
 * Public API unchanged. Service-internal transactions now use
 * `prisma.$transaction(async tx => …)`. The `tx` callback receives a
 * `Prisma.TransactionClient` that is passed into every repository method
 * that previously accepted a Kysely transaction handle.
 */
export class OrderService {
  constructor(
    private orderRepository: OrderRepository,
    private cartRepository: CartRepository,
    private paymentRepository: PaymentRepository,
    private gateway: IPaymentGateway,
    private prisma: PrismaClient,
    private notifications: INotificationService,
  ) {}

  async checkout(
    customerId: string,
    dto: CreateOrderDto,
  ): Promise<{
    orders: OrderEntity[];
    paymentMethod: string;
    paymentId?: string;
    paymentIds?: string[];
    paymentUrl: string;
  }> {
    const cart = await this.cartRepository.findActiveByUserId(customerId);
    if (!cart || cart.items.length === 0)
      throw new BadRequestError("Cart is empty");

    // Group items by sellerId
    const sellerGroups = new Map<string, typeof cart.items>();
    for (const item of cart.items) {
      const sellerId = await this.getSellerIdByVariantId(item.variantId);
      if (!sellerGroups.has(sellerId)) sellerGroups.set(sellerId, []);
      sellerGroups.get(sellerId)!.push(item);
    }

    const totalAmount = cart.items.reduce(
      (sum, item) => sum + (item.variantPrice ?? 0) * item.quantity,
      0,
    );

    const createdOrders: OrderEntity[] = [];

    let singlePaymentId: string | undefined;
    const codPaymentIds: string[] = [];

    await this.prisma.$transaction(async (trx) => {
      if (dto.gateway === "cod") {
        for (const [sellerId, items] of sellerGroups) {
          const orderTotal = items.reduce(
            (sum, it) => sum + (it.variantPrice ?? 0) * it.quantity,
            0,
          );

          const paymentId = await this.paymentRepository.create(
            {
              customerId,
              amount: orderTotal,
              currency: "VND",
              gateway: "cod",
              idempotencyKey: `checkout_cod_${cart.id}_${sellerId}`,
            },
            trx,
          );
          codPaymentIds.push(paymentId);

          const order = await this.createOrderForSeller(
            customerId,
            sellerId,
            items,
            dto,
            paymentId,
            trx,
          );
          createdOrders.push(order);

          // Publish a NEW_ORDER notification to the seller inside the
          // same transaction — guarantees the notification can never
          // be persisted without the order, or vice versa. The order
          // id is the natural `actionUrl` (full UUID; the dashboard
          // already routes by /orders/:id).
          await this.notifications.create(
            {
              sellerId,
              type: "NEW_ORDER",
              title: "New Order Received",
              message: `Order #${order.id.slice(0, 8)} has been placed.`,
              actionUrl: `/orders/${order.id}`,
            },
            trx,
          );
        }
      } else {
        singlePaymentId = await this.paymentRepository.create(
          {
            customerId,
            amount: totalAmount,
            currency: "VND",
            gateway: dto.gateway ?? "momo",
            idempotencyKey: `checkout_cart_${cart.id}`,
          },
          trx,
        );

        for (const [sellerId, items] of sellerGroups) {
          const order = await this.createOrderForSeller(
            customerId,
            sellerId,
            items,
            dto,
            singlePaymentId,
            trx,
          );
          createdOrders.push(order);

          await this.notifications.create(
            {
              sellerId,
              type: "NEW_ORDER",
              title: "New Order Received",
              message: `Order #${order.id.slice(0, 8)} has been placed.`,
              actionUrl: `/orders/${order.id}`,
            },
            trx,
          );
        }
      }

      // Mark cart as checked_out and clear items.
      await this.cartRepository.clearItems(cart.id, trx);
      await trx.cart.update({
        where: { id: cart.id },
        data: { status: "checked_out" },
      });
    });

    let paymentUrl = dto.returnUrl;

    if (dto.gateway === "cod") {
      return {
        orders: createdOrders,
        paymentMethod: "cod",
        paymentIds: codPaymentIds,
        paymentUrl,
      };
    }

    try {
      const session = await this.gateway.createSession({
        paymentId: singlePaymentId!,
        amount: totalAmount,
        currency: "VND",
        returnUrl: dto.returnUrl,
        cancelUrl: dto.cancelUrl,
        description: `Pay for ${createdOrders.length} orders`,
      });

      paymentUrl = session.paymentUrl;

      await this.paymentRepository.setGatewayRef(
        singlePaymentId!,
        session.gatewayRef,
        // Independent of the checkout transaction (it's already committed).
        this.prisma,
      );
    } catch (error) {
      console.error("Payment gateway call error:", error);
      throw new BadRequestError(
        "Order created successfully, but there's a MoMo connection error. Please try paying again later.",
      );
    }

    return {
      orders: createdOrders,
      paymentMethod: dto.gateway ?? "momo",
      paymentId: singlePaymentId,
      paymentUrl,
    };
  }

  async getMyOrders(
    userId: string,
    role: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    orders: OrderEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const result =
      role === "seller"
        ? await this.orderRepository.findBySellerId(userId, page, limit)
        : await this.orderRepository.findByCustomerId(userId, page, limit);

    return { ...result, page, limit };
  }

  async getOrderById(
    orderId: string,
    user: { userId: string; role: string },
  ): Promise<OrderEntity> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new NotFoundError(`Order with id "${orderId}" not found`);

    if (user.role === "customer" && order.customerId !== user.userId)
      throw new ForbiddenError("Access denied");

    if (user.role === "seller" && order.sellerId !== user.userId)
      throw new ForbiddenError("Access denied");

    return order;
  }

  async updateStatus(
    orderId: string,
    dto: UpdateOrderStatusDto,
    user: { userId: string; role: string },
  ): Promise<OrderEntity> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new NotFoundError(`Order with id "${orderId}" not found`);

    if (user.role === "seller" && order.sellerId !== user.userId)
      throw new ForbiddenError("Access denied");

    if (!order.canTransitionTo(dto.status))
      throw new BadRequestError(
        `Cannot transition from "${order.status}" to "${dto.status}"`,
      );

    await this.prisma.$transaction(async (trx) => {
      await this.orderRepository.updateStatus(
        orderId,
        dto.status,
        undefined,
        trx,
      );
      await this.orderRepository.createStatusLog(
        {
          orderId,
          fromStatus: order.status,
          toStatus: dto.status,
          changedBy: user.userId,
          note: dto.note,
        },
        trx,
      );

      // COD auto-settle: cash has been collected at the door, so the
      // linked Payment row must flip to `paid` atomically with the
      // status transition. The repository method guards on
      // `gateway = 'cod' AND status != 'paid'` and is a no-op for
      // anything else (vnpay/momo/stripe flows are settled by their
      // own gateway callbacks, never by the seller marking the order
      // as delivered). Same transaction guarantees the dashboard
      // refetch sees either both changes or neither.
      if (dto.status === "delivered" && order.paymentId) {
        const synced = await this.orderRepository.markCodPaymentAsPaid(
          order.paymentId,
          trx,
        );
        if (synced > 0) {
          // Note in the order's status log so the audit trail records
          // that the delivery also settled the payment. Skipped when
          // the payment was already paid / not COD — no log noise in
          // the common "mark already-paid delivered" flow.
          await this.orderRepository.createStatusLog(
            {
              orderId,
              fromStatus: dto.status,
              toStatus: dto.status,
              changedBy: null,
              note: "COD payment marked as paid on delivery",
            },
            trx,
          );
        }
      }
    });

    return (await this.orderRepository.findById(orderId))!;
  }

  async cancelOrder(
    orderId: string,
    dto: CancelOrderDto,
    user: { userId: string; role: string },
  ): Promise<OrderEntity> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new NotFoundError(`Order with id "${orderId}" not found`);

    if (user.role === "customer") {
      if (order.customerId !== user.userId) throw new ForbiddenError("Access denied");
      if (!order.canBeCancelledByCustomer())
        throw new BadRequestError(
          `Cannot cancel order with status "${order.status}"`,
        );
    }
    if (user.role === "seller" && order.sellerId !== user.userId)
      throw new ForbiddenError("Access denied");

    if (!order.canTransitionTo("cancelled"))
      throw new BadRequestError(
        `Cannot cancel order with status "${order.status}"`,
      );

    await this.prisma.$transaction(async (trx) => {
      if (order.paymentId) {
        const payment = await this.paymentRepository.findById(
          order.paymentId,
          trx,
        );

        if (payment && payment.status === "paid") {
          if (payment.gateway !== "cod" && payment.gatewayRef) {
            try {
              const refundResult = await this.gateway.refundTransaction({
                gatewayRef: payment.gatewayRef,
                amount: order.totalAmount,
                reason: dto.reason || "Customer requested cancellation",
              });

              await this.paymentRepository.updateStatus(
                payment.id,
                "refunded",
                {
                  gatewayData: {
                    ...((payment.gatewayData as Record<string, unknown>) || {}),
                    refundRef: refundResult.refundRef,
                    refundedAt: new Date().toISOString(),
                  },
                },
                trx,
              );
            } catch (error) {
              console.error("[Refund Error]", error);
              throw new BadRequestError(
                "Failed to process refund with Payment Gateway. Order cancellation aborted.",
              );
            }
          } else if (payment.gateway === "cod") {
            await this.paymentRepository.updateStatus(
              payment.id,
              "refunded",
              {
                gatewayData: {
                  ...((payment.gatewayData as Record<string, unknown>) || {}),
                  refundedBy: user.userId,
                  refundMethod: "cash",
                  refundedAt: new Date().toISOString(),
                },
              },
              trx,
            );
          }
        } else if (payment && payment.status === "pending") {
          await this.paymentRepository.updateStatus(
            payment.id,
            "cancelled",
            {},
            trx,
          );
        }
      }

      // Restock inventory — the deducted quantity comes back.
      for (const item of order.items) {
        await trx.inventory.update({
          where: { variantId: item.variantId },
          data: { quantity: { increment: item.quantity } },
        });
      }

      await this.orderRepository.updateStatus(
        orderId,
        "cancelled",
        dto.reason,
        trx,
      );

      await this.orderRepository.createStatusLog(
        {
          orderId,
          fromStatus: order.status,
          toStatus: "cancelled",
          changedBy: user.userId,
          note: dto.reason,
        },
        trx,
      );

      // Publish an ORDER_CANCELLED notification inside the same
      // transaction so the feed entry is atomic with the status flip.
      // The `who cancelled` differs: a customer-initiated cancel goes
      // to the seller; a seller-initiated cancel still fires the
      // notification (the seller sees their own action in the feed,
      // matching industry conventions for audit trails).
      const cancellerLabel =
        user.role === "seller"
          ? "You"
          : user.role === "admin"
            ? "An admin"
            : "The customer";
      await this.notifications.create(
        {
          sellerId: order.sellerId,
          type: "ORDER_CANCELLED",
          title: "Order Cancelled",
          message: `${cancellerLabel} cancelled order #${order.id.slice(0, 8)}.`,
          actionUrl: `/orders/${order.id}`,
        },
        trx,
      );
    });

    return (await this.orderRepository.findById(orderId))!;
  }

  private async createOrderForSeller(
    customerId: string,
    sellerId: string,
    items: {
      variantId: string;
      quantity: number;
      variantPrice?: number;
      productName?: string;
      variantSku?: string;
    }[],
    dto: CreateOrderDto,
    paymentId: string,
    trx: Prisma.TransactionClient,
  ): Promise<OrderEntity> {
    // 1. Lock inventory rows
    const variantIds = items.map((i) => i.variantId);
    const lockedInventory = await this.orderRepository.lockInventoryForUpdate(
      variantIds,
      trx,
    );

    // 2. Validate stock
    for (const item of items) {
      const inv = lockedInventory.find((l) => l.variantId === item.variantId);
      if (!inv)
        throw new NotFoundError(
          `Inventory not found for variant with id ${item.variantId}`,
        );
      if (inv.quantity < item.quantity)
        throw new BadRequestError(
          `Not enough stock for "${item.variantSku}". `,
        );
    }

    // 3. Total
    const totalAmount = items.reduce(
      (sum, item) => sum + (item.variantPrice ?? 0) * item.quantity,
      0,
    );

    // 4. Create order
    const orderId = await this.orderRepository.createOrder(
      {
        customerId,
        sellerId,
        totalAmount,
        shippingName: dto.shippingName,
        shippingPhone: dto.shippingPhone,
        shippingAddress: dto.shippingAddress,
        note: dto.note,
        paymentId,
      },
      trx,
    );

    // 5. Create order_items (snapshot)
    await this.orderRepository.createOrderItems(
      items.map((item) => ({
        orderId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.variantPrice ?? 0,
        productName: item.productName ?? "",
        variantSku: item.variantSku ?? "",
      })),
      trx,
    );

    // 6. Subtract inventory + release reserved
    for (const item of items) {
      await this.orderRepository.deductInventory(
        item.variantId,
        item.quantity,
        trx,
      );
    }

    // 7. Status log
    await this.orderRepository.createStatusLog(
      {
        orderId,
        fromStatus: null,
        toStatus: "pending",
        changedBy: customerId,
        note: "Order created",
      },
      trx,
    );

    const order = await this.orderRepository.findById(orderId, trx);
    return order!;
  }

  private async getSellerIdByVariantId(variantId: string): Promise<string> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: {
        product: {
          select: { sellerId: true, deletedAt: true },
        },
      },
    });

    if (!variant?.product || variant.product.deletedAt) {
      throw new NotFoundError(`Variant with id "${variantId}" not found`);
    }
    return variant.product.sellerId;
  }
}
