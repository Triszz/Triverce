import { Router } from "express";
import { SellerController } from "./seller.controller";
import { authenticate } from "../../core/middleware/auth.middleware";
import { requireRole } from "../../core/middleware/rbac.middleware";

export function createSellerRouter(controller: SellerController): Router {
  const router = Router();

  /**
   * GET /api/seller/profile
   *
   * Returns the authenticated seller's storefront profile.
   * Requires a valid seller JWT.
   */
  router.get(
    "/profile",
    authenticate,
    requireRole("seller", "admin"),
    controller.getStoreProfile,
  );

  /**
   * PUT /api/seller/profile
   *
   * Updates the authenticated seller's storefront profile fields.
   * All body fields are optional — only provided fields are written.
   * Requires a valid seller JWT.
   */
  router.put(
    "/profile",
    authenticate,
    requireRole("seller", "admin"),
    controller.updateStoreProfile,
  );

  return router;
}
