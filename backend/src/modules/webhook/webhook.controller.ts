import { Request, Response, NextFunction } from "express";
import { WebhookService } from "./webhook.service";

export class WebhookController {
  constructor(private webhookService: WebhookService) {}

  handleMoMoWebhook = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      // rawBody needs to be set by the express.raw()
      const rawBody = req.body as Buffer;
      const signature = (req.headers["x-momo-signature"] as string) ?? "";

      await this.webhookService.handlePaymentWebhook(rawBody, signature);

      // Gateway needs to receive 200 IMMEDIATELY — otherwise it will retry
      res.status(200).json({ received: true });
    } catch (error) {
      console.error("[Webhook Error]", error);
      res.status(200).json({ received: true });
    }
  };
  // Manual endpoint testing (only for use with MockAdapter)
  handleMockWebhook = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const rawBody = Buffer.from(JSON.stringify(req.body));
      const signature = ""; // Mock does not verify signature

      await this.webhookService.handlePaymentWebhook(rawBody, signature);

      res.status(200).json({ received: true });
    } catch (error) {
      next(error);
    }
  };
}
