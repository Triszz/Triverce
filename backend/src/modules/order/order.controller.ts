import { z } from "zod";
import { Request, Response, NextFunction } from "express";
import { OrderService } from "./order.service";
import {
  CreateOrderDto,
  UpdateOrderStatusDto,
  CancelOrderDto,
} from "./order.dto";
import type { OrderStatus } from "./order.entity";

/**
 * Query schema for `GET /api/orders`. Validates the optional `status`
 * filter against the `OrderStatus` union before the service sees it.
 * Bad values (typos, etc.) get a clean 400 rather than a silent no-op
 * that returns every order regardless.
 */
const ListOrdersQuerySchema = z.object({
  status: z
    .enum([
      "pending",
      "confirmed",
      "shipping",
      "delivered",
      "cancelled",
      "failed",
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export class OrderController {
  constructor(private orderService: OrderService) {}

  // Checkout
  checkout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const checkoutResult = await this.orderService.checkout(
        req.user!.userId,
        req.body as CreateOrderDto,
      );
      res.status(201).json({
        success: true,
        data: {
          orders: checkoutResult.orders.map((o) => o.toPublic()),
          paymentMethod: checkoutResult.paymentMethod,
          paymentId: checkoutResult.paymentId,
          paymentIds: checkoutResult.paymentIds,
          paymentUrl: checkoutResult.paymentUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // Get user orders
  getMyOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Manual validation here (instead of using `validateQuery`) because
      // we don't want a separate middleware import for one tiny schema
      // and the safeParse + 400 flow is well-trodden in this codebase.
      const parsed = ListOrdersQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid query parameters",
          errors: parsed.error.issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
      }
      const { status, page, limit } = parsed.data;
      const result = await this.orderService.getMyOrders(
        req.user!.userId,
        req.user!.role,
        page,
        limit,
        status as OrderStatus | undefined,
      );
      res.status(200).json({
        success: true,
        data: {
          ...result,
          orders: result.orders.map((o) => o.toPublic()),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // Get orders count grouped by status (used by the buyer's tab bar).
  // Returns all 6 statuses seeded with 0 so the frontend doesn't need
  // to guard against `undefined` for empty buckets.
  getOrderCounts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const counts = await this.orderService.getOrderCounts(
        req.user!.userId,
        req.user!.role,
      );
      // `total` is computed client-side as the sum of the per-status
      // buckets. We expose it here too as a convenience so the
      // frontend can render "All (N)" without adding the buckets
      // itself.
      const total = Object.values(counts).reduce((s, n) => s + n, 0);
      res.status(200).json({
        success: true,
        data: {
          total,
          ...counts,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // Get order by id
  getOrderById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await this.orderService.getOrderById(
        req.params.id as string,
        req.user!,
      );
      res.status(200).json({
        success: true,
        data: order.toPublic(),
      });
    } catch (error) {
      next(error);
    }
  };
  // Update order status
  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await this.orderService.updateStatus(
        req.params.id as string,
        req.body as UpdateOrderStatusDto,
        req.user!,
      );
      res.status(200).json({
        success: true,
        data: order.toPublic(),
      });
    } catch (error) {
      next(error);
    }
  };

  // Cancel order
  cancelOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await this.orderService.cancelOrder(
        req.params.id as string,
        req.body as CancelOrderDto,
        req.user!,
      );
      res.status(200).json({
        success: true,
        data: order.toPublic(),
      });
    } catch (error) {
      next(error);
    }
  };
}
