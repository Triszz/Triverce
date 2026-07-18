import { Router } from "express";
import { UploadController } from "./upload.controller";
import { multerUpload } from "../../infrastructure/storage/multer.config";
import { authenticate } from "../../core/middleware/auth.middleware";
import { requireRole } from "../../core/middleware/rbac.middleware";

export const createUploadRouter = (controller: UploadController) => {
  const router = Router();

  // Upload one or more product images (max 10 per request). The dashboard
  // bundles these into `images[]` in a single round-trip — element [0]
  // is treated as the primary / thumbnail image.
  router.post(
    "/products/:productId",
    authenticate,
    requireRole("seller", "admin"),
    multerUpload.array("images", 10),
    controller.uploadProductImages,
  );

  // Upload variant image
  router.post(
    "/variants/:variantId",
    authenticate,
    requireRole("seller", "admin"),
    multerUpload.single("image"),
    controller.uploadVariantImage,
  );

  // Upload store logo
  router.post(
    "/logos/:sellerId",
    authenticate,
    requireRole("seller", "admin"),
    multerUpload.single("logo"),
    controller.uploadLogo,
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
