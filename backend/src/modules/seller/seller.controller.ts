import { Request, Response, NextFunction } from "express";
import { SellerService } from "./seller.service";
import { UnauthorizedError } from "../../core/errors/AppError";

export class SellerController {
  constructor(private sellerService: SellerService) {}

  /**
   * GET /api/stores/:sellerId — public store profile.
   * No authentication required.
   */
  getPublicStoreProfile = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const sellerId = req.params.sellerId as string;
      const data = await this.sellerService.getPublicStoreProfile(sellerId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/seller/stores — paginated public list of stores matching
   * the `?search=` query. Case-insensitive substring match on
   * `storeName`. No authentication required.
   *
   * Query params:
   *   • search (required, non-empty after trim)
   *   • limit  (optional, 1–50, defaults to 10)
   */
  listPublicStores = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const search = String(req.query.search ?? "").trim();
      if (!search) {
        res.status(200).json({ success: true, data: [] });
        return;
      }
      const rawLimit = Number(req.query.limit);
      const limit = Number.isFinite(rawLimit)
        ? Math.min(Math.max(Math.floor(rawLimit), 1), 50)
        : undefined;

      const data = await this.sellerService.listPublicStores({ search, limit });
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getStoreProfile = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required");
      }
      const data = await this.sellerService.getStoreProfile(req.user.userId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  updateStoreProfile = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required");
      }
      const data = await this.sellerService.updateStoreProfile(
        req.user.userId,
        req.body,
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
