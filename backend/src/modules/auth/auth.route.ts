import { Router } from "express";
import { validate } from "../../core/middleware/validate.middleware";
import { authenticate } from "../../core/middleware/auth.middleware";
import {
  RegisterSchema,
  LoginSchema,
  UpdateProfileSchema,
  ChangePasswordSchema,
} from "./auth.dto";
import { AuthController } from "./auth.controller";

export const createAuthRouter = (authController: AuthController) => {
  const router = Router();

  // Public — sign up / sign in / refresh / sign out
  router.post("/register", validate(RegisterSchema), authController.register);
  router.post("/login", validate(LoginSchema), authController.login);
  router.post("/refresh", authController.refresh);
  router.post("/logout", authController.logout);

  // Protected — self-service account management
  router.patch(
    "/me/profile",
    authenticate,
    validate(UpdateProfileSchema),
    authController.updateProfile,
  );
  router.patch(
    "/me/password",
    authenticate,
    validate(ChangePasswordSchema),
    authController.changePassword,
  );

  return router;
};
