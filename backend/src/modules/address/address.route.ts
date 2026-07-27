import { Router } from "express";
import { UserAddressController } from "./address.controller";
import { authenticate } from "../../core/middleware/auth.middleware";

/**
 * User address routes — `/api/user/addresses`.
 *
 * All routes are customer-scoped (buyer side). Both endpoints require a
 * valid JWT so `req.user.userId` is always the authenticated user.
 */
export function createUserAddressRouter(
  controller: UserAddressController,
): Router {
  const router = Router();

  router.use(authenticate);

  router.get("/", controller.list);
  router.post("/", controller.create);

  return router;
}
