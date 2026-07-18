import { Request, Response, NextFunction } from "express";
import { SellerService } from "./seller.service";
import { UnauthorizedError } from "../../core/errors/AppError";

export class SellerController {
  constructor(private sellerService: SellerService) {}

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
