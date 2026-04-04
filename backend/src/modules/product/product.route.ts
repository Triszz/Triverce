import { Router } from "express";
import { ProductController } from "./product.controller";
import {
  validate,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import { authenticate } from "../../core/middleware/auth.middleware";
import { requireRole } from "../../core/middleware/rbac.middleware";
import {
  CreateProductSchema,
  UpdateProductSchema,
  AddVariantSchema,
  UpdateVariantSchema,
  ProductQuerySchema,
} from "./product.dto";

export const createProductRouter = (controller: ProductController) => {
  const router = Router();

  // Public routes
  router.get("/", validateQuery(ProductQuerySchema), controller.getAll);
  router.get("/slug/:slug", controller.getBySlug);
  router.get("/:id", controller.getById);

  // Seller & Admin routes
  router.post(
    "/",
    authenticate,
    requireRole("seller", "admin"),
    validate(CreateProductSchema),
    controller.create,
  );

  router.patch(
    "/:id",
    authenticate,
    requireRole("seller", "admin"),
    validate(UpdateProductSchema),
    controller.update,
  );

  router.delete(
    "/:id",
    authenticate,
    requireRole("seller", "admin"),
    controller.delete,
  );

  // Variant routes
  router.post(
    "/:id/variants",
    authenticate,
    requireRole("seller", "admin"),
    validate(AddVariantSchema),
    controller.addVariant,
  );

  router.patch(
    "/:id/variants/:vid",
    authenticate,
    requireRole("seller", "admin"),
    validate(UpdateVariantSchema),
    controller.updateVariant,
  );

  router.delete(
    "/:id/variants/:vid",
    authenticate,
    requireRole("seller", "admin"),
    controller.deleteVariant,
  );

  return router;
};
