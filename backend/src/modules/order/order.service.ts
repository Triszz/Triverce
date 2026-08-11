import type { PrismaClient, Prisma } from "@prisma/client";
import { OrderRepository } from "./order.repository";
import { OrderEntity, type OrderStatus } from "./order.entity";
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
import type { IUserAddressService } from "../../core/interfaces/IUserAddressService";

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
    private userAddresses: IUserAddressService,
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

    // Multi-vendor cart selection — when the buyer calls checkout
    // with `cartItemIds`, only the selected items are charged and
    // turned into orders. The rest of the cart stays put so the
    // buyer can come back and checkout the remaining items later.
    // The cart's status remains `active` (we don't flip it to
    // `checked_out` because the cart still has items in it).
    //
    // IDs that don't belong to THIS cart are silently dropped — the
    // cart page only ever shows its own items, so an ID mismatch
    // here means stale state (e.g. the user removed an item in
    // another tab). Dropping rather than 400'ing keeps the UX
    // graceful: the user just gets a checkout for whatever is still
    // there.
    let checkoutItems = cart.items;
    if (dto.cartItemIds !== undefined) {
      if (dto.cartItemIds.length === 0) {
        throw new BadRequestError(
          "No cart items selected for checkout",
        );
      }
      const allowedIds = new Set(cart.items.map((i) => i.id));
      checkoutItems = cart.items.filter((i) =>
        allowedIds.has(i.id) && dto.cartItemIds!.includes(i.id),
      );
      if (checkoutItems.length === 0) {
        throw new BadRequestError(
          "Selected items are no longer in your cart",
        );
      }
    }

    // Group items by sellerId
    const sellerGroups = new Map<string, typeof checkoutItems>();
    for (const item of checkoutItems) {
      const sellerId = await this.getSellerIdByVariantId(item.variantId);
      if (!sellerGroups.has(sellerId)) sellerGroups.set(sellerId, []);
      sellerGroups.get(sellerId)!.push(item);
    }

    const createdOrders: OrderEntity[] = [];

    let singlePaymentId: string | undefined;
    const codPaymentIds: string[] = [];
    // Will hold the sum of all per-seller order totals for the gateway call.
    let cartTotal = 0;

    await this.prisma.$transaction(async (trx) => {
      // Pre-compute per-seller subtotals and shipping so:
      //   (a) the shared payment row amount is correct,
      //   (b) each seller's order total is correct,
      //   (c) the gateway session amount matches the payment row.
      // This avoids a second round-trip to recalculate after orders are created.
      const sellerPricing = new Map<
        string,
        { subtotal: number; shippingFee: number; total: number }
      >();
      for (const [sellerId, items] of sellerGroups) {
        const subtotal = items.reduce(
          (s, it) => s + (it.variantPrice ?? 0) * it.quantity,
          0,
        );
        const shippingFee = subtotal > 500000 ? 0 : 30000;
        sellerPricing.set(sellerId, {
          subtotal,
          shippingFee,
          total: subtotal + shippingFee,
        });
      }

      if (dto.gateway === "cod") {
        for (const [sellerId, items] of sellerGroups) {
          const { subtotal } = sellerPricing.get(sellerId)!;

          const paymentId = await this.paymentRepository.create(
            {
              customerId,
              amount: subtotal,
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
            subtotal,
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
      } else {
        // Non-COD: one shared payment row for the whole cart.
        // Amount = sum of all per-seller order totals (each with shipping).
        cartTotal = Array.from(sellerPricing.values()).reduce(
          (s, p) => s + p.total,
          0,
        );
        singlePaymentId = await this.paymentRepository.create(
          {
            customerId,
            amount: cartTotal,
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
            sellerPricing.get(sellerId)!.subtotal,
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

      // Post-checkout cleanup.
      //
      //   • Full-cart checkout (no `cartItemIds`) — every item has
      //     been ordered, so clear the cart and flip its status to
      //     `checked_out`. The next call to `findActiveByUserId`
      //     will create a fresh empty cart.
      //
      //   • Partial checkout (with `cartItemIds`) — only the
      //     selected items have been ordered. Remove those rows so
      //     the buyer can see the remaining items still waiting,
      //     and keep the cart in `active` status so they can come
      //     back and checkout the rest without a re-login.
      if (dto.cartItemIds === undefined) {
        await this.cartRepository.clearItems(cart.id, trx);
        await trx.cart.update({
          where: { id: cart.id },
          data: { status: "checked_out" },
        });
      } else {
        const orderedIds = checkoutItems.map((i) => i.id);
        await trx.cartItem.deleteMany({
          where: { cartId: cart.id, id: { in: orderedIds } },
        });
        // Cart stays `active` — the buyer still has items in it.
      }

      // Auto-save the shipping address if it's not already in the user's
      // address book. Runs inside the same transaction so the save and the
      // order creation are atomic — a failed address insert won't block the
      // order. This is best-effort (non-blocking) so address-book errors
      // don't abort the checkout.
      await this.userAddresses
        .createIfNotDuplicate(
          customerId,
          dto.shippingName,
          dto.shippingPhone,
          dto.shippingAddress,
          trx,
        )
        .catch((err) => {
          // Log but don't re-throw — checkout must not fail due to an
          // optional address-book save failure.
          console.warn("[AddressBook] Failed to auto-save address:", err);
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
        amount: cartTotal,
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

  /**
   * Lightweight count of orders grouped by status for the current
   * customer. Used by the `MyOrdersPage` tab bar so every tab can
   * render its count without a separate paginated fetch per tab.
   *
   * No pagination / role filtering — the repo method is purpose-built
   * to be a single GROUP BY round-trip.
   */
  async getOrderCounts(
    userId: string,
    role: string,
  ): Promise<Record<OrderStatus, number>> {
    // Sellers don't currently have a tab bar in the buyer UI, but
    // returning the same shape keeps the controller simple — the
    // repository's `findBySellerId` doesn't need counts, so for the
    // seller path we just return an empty map. If a seller dashboard
    // wants counts later, the repo can be extended symmetrically.
    if (role === "seller") {
      return {
        pending: 0,
        confirmed: 0,
        shipping: 0,
        delivered: 0,
        cancelled: 0,
        failed: 0,
      };
    }
    return this.orderRepository.countByStatus(userId);
  }

  async getMyOrders(
    userId: string,
    role: string,
    page: number = 1,
    limit: number = 10,
    /**
     * Optional status filter. When supplied, the controller must have
     * already validated it against the `OrderStatus` enum (see
     * `OrderController.getMyOrders`). `null` / undefined means "all".
     */
    status?: OrderStatus,
  ): Promise<{
    orders: OrderEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const result =
      role === "seller"
        ? await this.orderRepository.findBySellerId(userId, page, limit, status)
        : await this.orderRepository.findByCustomerId(userId, page, limit, status);

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
      if (order.customerId !== user.userId)
        throw new ForbiddenError("Access denied");
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
    /** Pre-computed subtotal from the caller to guarantee the payment row
     *  and the order row use the same authoritative base amount. */
    subtotal: number,
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

    // 3. Strict backend pricing: we NEVER trust client-submitted totals.
    //    `subtotal` is pre-computed by the caller (single source of truth
    //    for both the payment row and the order total below).
    //    Shipping rule: free for orders >= 500,000 VND, otherwise 30,000 VND.
    const shippingFee = subtotal > 500000 ? 0 : 30000;
    const totalAmount = subtotal + shippingFee;

    // 4. Create order
    const orderId = await this.orderRepository.createOrder(
      {
        customerId,
        sellerId,
        totalAmount,
        shippingFee,
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
