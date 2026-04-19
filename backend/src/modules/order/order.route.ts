import { Router } from "express";
import { OrderController } from "./order.controller";
import { validate } from "../../core/middleware/validate.middleware";
import { authenticate } from "../../core/middleware/auth.middleware";
import { requireRole } from "../../core/middleware/rbac.middleware";
import {
  CreateOrderSchema,
  UpdateOrderStatusSchema,
  CancelOrderSchema,
} from "./order.dto";

export const createOrderRouter = (controller: OrderController) => {
  const router = Router();

  router.use(authenticate);

  // Customer checkout
  router.post(
    "/",
    requireRole("customer"),
    validate(CreateOrderSchema),
    controller.checkout,
  );

  // Get orders list
  router.get(
    "/",
    requireRole("customer", "seller", "admin"),
    controller.getMyOrders,
  );

  // Get 1 order
  router.get(
    "/:id",
    requireRole("customer", "seller", "admin"),
    controller.getOrderById,
  );

  // Seller/Admin update order status
  router.patch(
    "/:id/status",
    requireRole("seller", "admin"),
    validate(UpdateOrderStatusSchema),
    controller.updateStatus,
  );

  // Customer/Seller/Admin cancel order
  router.patch(
    "/:id/cancel",
    requireRole("customer", "seller", "admin"),
    validate(CancelOrderSchema),
    controller.cancelOrder,
  );

  return router;
};
