import { OrderRepository } from "./order.repository";
import { OrderEntity } from "./order.entity";
import { CartEntity } from "../cart/cart.entity";
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

export class OrderService {
  constructor(
    private orderRepository: OrderRepository,
    private cartRepository: CartRepository,
  ) {}

  async checkout(
    customerId: string,
    dto: CreateOrderDto,
  ): Promise<OrderEntity[]> {
    // 1. Get cart + validate
    const cart = await this.cartRepository.findActiveByUserId(customerId);
    if (!cart || cart.items.length === 0)
      throw new BadRequestError("Cart is empty");

    // 2. Group items by sellerId
    const sellerGroups = new Map<string, typeof cart.items>();
    for (const item of cart.items) {
      // Get sellerId from product via variant
      const sellerId = await this.getSellerIdByVariantId(item.variantId);

      if (!sellerGroups.has(sellerId)) {
        sellerGroups.set(sellerId, []);
      }
      sellerGroups.get(sellerId)!.push(item);
    }

    const createdOrders: OrderEntity[] = [];

    await this.orderRepository.client.transaction().execute(async (trx) => {
      // 3. Create a separate order for each seller - one transaction per seller
      for (const [sellerId, items] of sellerGroups) {
        const order = await this.createOrderForSeller(
          customerId,
          sellerId,
          items,
          dto,
          trx,
        );
        createdOrders.push(order);
      }

      // 4. Clear the cart after all orders have been successfully created
      await this.cartRepository.clearItems(cart.id, trx);
      await trx
        .updateTable("carts")
        .set({ status: "checked_out", updated_at: new Date() })
        .where("id", "=", cart.id)
        .execute();
    });

    return createdOrders;
  }

  // Get user orders
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

  // Get order by id
  async getOrderById(
    orderId: string,
    user: { userId: string; role: string },
  ): Promise<OrderEntity> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new NotFoundError(`Order with id "${orderId}" not found`);

    // Customer only views their own order
    if (user.role === "customer" && order.customerId !== user.userId)
      throw new ForbiddenError("Access denied");

    // Seller only views order that has sellerId = their id
    if (user.role === "seller" && order.sellerId !== user.userId)
      throw new ForbiddenError("Access denied");

    return order;
  }

  // Update status
  async updateStatus(
    orderId: string,
    dto: UpdateOrderStatusDto,
    user: { userId: string; role: string },
  ): Promise<OrderEntity> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new NotFoundError(`Order with id "${orderId}" not found`);

    // Seller only updates their order
    if (user.role === "seller" && order.sellerId !== user.userId)
      throw new ForbiddenError("Access denied");

    // Validate valid transaction
    if (!order.canTransitionTo(dto.status))
      throw new BadRequestError(
        `Cannot transition from "${order.status}" to "${dto.status}"`,
      );

    await this.orderRepository.client.transaction().execute(async (trx) => {
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
    });

    return (await this.orderRepository.findById(orderId))!;
  }

  // Cancel order
  async cancelOrder(
    orderId: string,
    dto: CancelOrderDto,
    user: { userId: string; role: string },
  ): Promise<OrderEntity> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new NotFoundError(`Order with id "${orderId}" not found`);

    // Customers only cancel their order when they are pending
    if (user.role === "customer") {
      if (order.customerId !== user.userId)
        throw new ForbiddenError("Access denied");

      if (!order.canBeCancelledByCustomer())
        throw new BadRequestError(
          `Cannot cancel order with status "${order.status}"`,
        );
    }

    // Seller only cancel their order
    if (user.role === "seller" && order.sellerId !== user.userId)
      throw new ForbiddenError("Access denied");

    if (!order.canTransitionTo("cancelled"))
      throw new BadRequestError(
        `Cannot cancel order with status "${order.status}"`,
      );

    await this.orderRepository.client.transaction().execute(async (trx) => {
      // Return back for inventory
      for (const item of order.items) {
        await trx
          .updateTable("inventory")
          .set((eb) => ({
            quantity: eb("quantity", "+", item.quantity),
            updated_at: new Date(),
          }))
          .where("variant_id", "=", item.variantId)
          .execute();
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
    });

    return (await this.orderRepository.findById(orderId))!;
  }

  // Helpers
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
    trx: any,
  ): Promise<OrderEntity> {
    // 1. SELECT FOR UPDATE - lock inventory rows
    const variantIds = items.map((i) => i.variantId);
    const lockedInventory = await this.orderRepository.lockInventoryForUpdate(
      variantIds,
      trx,
    );

    // 2. Validate each item - avoid oversell
    for (const item of items) {
      const inv = lockedInventory.find((l) => l.variantId === item.variantId);
      if (!inv)
        throw new NotFoundError(
          `Inventory not found for variant with id ${item.variantId}`,
        );

      if (inv.quantity < item.quantity)
        throw new BadRequestError(
          `Stock error for "${item.variantSku}". ` +
            `Physical quantity: ${inv.quantity}, Requested: ${item.quantity}`,
        );
    }

    // 3. Calculate total
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

    // 7. Write status log
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

    // 8. Load and return order
    const order = await this.orderRepository.findById(orderId, trx);
    return order!;
  }
  private async getSellerIdByVariantId(variantId: string): Promise<string> {
    const row = await this.orderRepository.client
      .selectFrom("product_variants")
      .innerJoin("products", "products.id", "product_variants.product_id")
      .select("products.seller_id")
      .where("product_variants.id", "=", variantId)
      .executeTakeFirst();

    if (!row)
      throw new NotFoundError(`Variant with id "${variantId}" not found`);

    return row.seller_id;
  }
}
