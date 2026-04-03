import { Router } from "express";
import { CategoryController } from "./category.controller";
import {
  validate,
  validateQuery,
} from "../../core/middleware/validate.middleware";
import { authenticate } from "../../core/middleware/auth.middleware";
import { requireRole } from "../../core/middleware/rbac.middleware";
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  CategoryQuerySchema,
} from "./category.dto";

export const createCategoryRouter = (controller: CategoryController) => {
  const router = Router();

  // Public routes
  router.get("/", validateQuery(CategoryQuerySchema), controller.getAll);
  router.get("/slug/:slug", controller.getBySlug);
  router.get("/:id", controller.getById);

  // Admin only routes
  router.post(
    "/",
    authenticate,
    requireRole("admin"),
    validate(CreateCategorySchema),
    controller.create,
  );

  router.patch(
    "/:id",
    authenticate,
    requireRole("admin"),
    validate(UpdateCategorySchema),
    controller.update,
  );

  router.delete("/:id", authenticate, requireRole("admin"), controller.delete);

  return router;
};
