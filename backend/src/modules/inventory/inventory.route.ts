import { Router } from "express";
import { InventoryController } from "./inventory.controller";
import { validate } from "../../core/middleware/validate.middleware";
import { authenticate } from "../../core/middleware/auth.middleware";
import { requireRole } from "../../core/middleware/rbac.middleware";
import { UpdateInventorySchema, AdjustInventorySchema } from "./inventory.dto";

export const createInventoryRouter = (controller: InventoryController) => {
  const router = Router();

  // Seller + Admin check inventory
  router.get(
    "/variant/:variantId",
    authenticate,
    requireRole("seller", "admin"),
    controller.getByVariantId,
  );

  router.get(
    "/product/:productId",
    authenticate,
    requireRole("seller", "admin"),
    controller.getByProductId,
  );

  // Set fixed quantity
  router.patch(
    "/variant/:variantId/set",
    authenticate,
    requireRole("seller", "admin"),
    validate(UpdateInventorySchema),
    controller.setQuantity,
  );

  // Adjust inventory (addition/subtraction)
  router.patch(
    "/variant/:variantId/adjust",
    authenticate,
    requireRole("seller", "admin"),
    validate(AdjustInventorySchema),
    controller.adjustQuantity,
  );

  return router;
};
