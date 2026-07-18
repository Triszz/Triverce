import { Router } from "express";
import { DashboardController } from "./dashboard.controller";
import { authenticate } from "../../core/middleware/auth.middleware";

export function createDashboardRouter(
  dashboardController: DashboardController,
): Router {
  const router = Router();

  /**
   * GET /api/seller/dashboard
   *
   * Protected: requires a valid seller JWT. The `authenticate` middleware
   * verifies the token and attaches `req.user`. The controller reads
   * `req.user.userId` to scope all aggregation queries.
   */
  router.get("/", authenticate, dashboardController.getDashboard);

  return router;
}
