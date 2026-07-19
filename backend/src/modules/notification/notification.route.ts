import { Router } from "express";
import { NotificationController } from "./notification.controller";
import { authenticate } from "../../core/middleware/auth.middleware";

/**
 * Notification routes — exposed under `/api/notifications`.
 *
 * All endpoints are seller-scoped (the seller is the only role that
 * has a notification feed). The `authenticate` middleware is
 * mounted on the router so every handler can rely on `req.user`
 * being populated.
 *
 * Note on the path order: `/:id/read` is registered AFTER `/read-all`
 * so Express matches `/read-all` literally before falling into the
 * `:id` parameter (otherwise `/read-all` would parse `read-all` as
 * `:id` and 400 on the missing `read` segment).
 */
export function createNotificationRouter(
  controller: NotificationController,
): Router {
  const router = Router();

  router.use(authenticate);

  router.get("/", controller.list);

  // Order matters: register the literal `/read-all` before the
  // `:id`-based route so it isn't captured by `:id`.
  router.patch("/read-all", controller.markAllRead);

  router.patch("/:id/read", controller.markRead);

  return router;
}
