import { Request, Response, NextFunction } from "express";
import { DashboardService } from "./dashboard.service";
import { UnauthorizedError } from "../../core/errors/AppError";

export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  /**
   * GET /api/seller/dashboard
   *
   * Returns aggregated metrics and the 5 most recent orders for the
   * authenticated seller. Requires a valid JWT; sellerId is extracted
   * from `req.user.userId`.
   */
  getDashboard = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required");
      }

      const sellerId = req.user.userId;
      const data = await this.dashboardService.getDashboard(sellerId);

      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
