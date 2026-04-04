import { Router } from "express";
import { validate } from "../../core/middleware/validate.middleware";
import { RegisterSchema, LoginSchema } from "./auth.dto";
import { AuthController } from "./auth.controller";

export const createAuthRouter = (authController: AuthController) => {
  const router = Router();

  router.post("/register", validate(RegisterSchema), authController.register);
  router.post("/login", validate(LoginSchema), authController.login);
  router.post("/refresh", authController.refresh);
  router.post("/logout", authController.logout);

  return router;
};
