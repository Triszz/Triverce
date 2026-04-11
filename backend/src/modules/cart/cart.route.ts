import { Router } from "express";
import { CartController } from "./cart.controller";
import { validate } from "../../core/middleware/validate.middleware";
import { authenticate } from "../../core/middleware/auth.middleware";
import { requireRole } from "../../core/middleware/rbac.middleware";
import { AddCartItemSchema, UpdateCartItemSchema } from "./cart.dto";

export const createCartRouter = (controller: CartController) => {
  const router = Router();

  // Only customer has cart
  router.use(authenticate, requireRole("customer"));

  router.get("/", controller.getCart);
  router.post("/items", validate(AddCartItemSchema), controller.addItem);
  router.patch(
    "/items/:itemId",
    validate(UpdateCartItemSchema),
    controller.updateItem,
  );
  router.delete("/items/:itemId", controller.removeItem);
  router.delete("/", controller.clearCart);

  return router;
};
