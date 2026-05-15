import { Router } from "express";
import { PaymentController } from "./payment.controller";
import { authenticate } from "../../core/middleware/auth.middleware";
import { requireRole } from "../../core/middleware/rbac.middleware";

export const createPaymentRouter = (controller: PaymentController) => {
  const router = Router();

  router.use(authenticate);

  router.post(
    "/:paymentId/retry",
    requireRole("customer"),
    controller.retrySession,
  );
  router.get("/:paymentId/verify", requireRole("customer"), controller.verify);

  router.post(
    "/:paymentId/confirm-cod",
    requireRole("seller"),
    controller.confirmCOD,
  );

  return router;
};
