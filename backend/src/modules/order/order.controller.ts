import { Request, Response, NextFunction } from "express";
import { OrderService } from "./order.service";
import {
  CreateOrderDto,
  UpdateOrderStatusDto,
  CancelOrderDto,
} from "./order.dto";

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
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const result = await this.orderService.getMyOrders(
        req.user!.userId,
        req.user!.role,
        page,
        limit,
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
