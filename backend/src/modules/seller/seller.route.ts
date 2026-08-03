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

  /**
   * GET /api/seller/stores?search=&limit=
   *
   * Public list of storefronts matching a case-insensitive `search`
   * against `storeName`. Powers the buyer-side global search results
   * on `/shop?q=…`. No authentication required.
   *
   * Declared BEFORE `/:sellerId` so the static segment isn't captured
   * as a dynamic parameter.
   */
  router.get("/stores", controller.listPublicStores);

  /**
   * GET /api/seller/:sellerId
   *
   * Returns a seller's public storefront profile: storeName, logo,
   * description, joined date, and active product count.
   * No authentication required — public-facing endpoint for buyers.
   * Placed AFTER /profile so the static path is matched first.
   */
  router.get(
    "/:sellerId",
    controller.getPublicStoreProfile,
  );

  return router;
}
