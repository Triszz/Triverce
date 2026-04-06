import { Router } from "express";
import { UploadController } from "./upload.controller";
import { multerUpload } from "../../infrastructure/storage/multer.config";
import { authenticate } from "../../core/middleware/auth.middleware";
import { requireRole } from "../../core/middleware/rbac.middleware";

export const createUploadRouter = (controller: UploadController) => {
  const router = Router();

  // Upload product image
  router.post(
    "/products/:productId",
    authenticate,
    requireRole("seller", "admin"),
    multerUpload.single("image"),
    controller.uploadProductImage,
  );

  // Upload variant image
  router.post(
    "/variants/:variantId",
    authenticate,
    requireRole("seller", "admin"),
    multerUpload.single("image"),
    controller.uploadVariantImage,
  );

  // Delete file
  router.delete(
    "/:folder/:filename",
    authenticate,
    requireRole("seller", "admin"),
    controller.deleteFile,
  );

  return router;
};
