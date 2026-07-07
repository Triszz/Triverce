import { Router } from "express";
import express from "express";
import { WebhookController } from "./webhook.controller";

export const createWebhookRouter = (controller: WebhookController) => {
  const router = Router();

  // DO NOT use authMiddleware for webhook
  // express.raw() to get the raw buffer — this is required to verify the HMAC signature
  router.post(
    "/momo",
    express.raw({ type: "application/json" }),
    controller.handleMoMoWebhook,
  );

  router.post(
    "/vnpay",
    express.urlencoded({ extended: false }),
    controller.handleVNPayWebhook,
  );

  return router;
};
