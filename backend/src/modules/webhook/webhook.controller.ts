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

      await this.webhookService.handlePaymentWebhook(
        "momo",
        rawBody,
        signature,
      );

      // Gateway needs to receive 200 IMMEDIATELY — otherwise it will retry
      res.status(200).json({ received: true });
    } catch (error) {
      console.error("[Webhook Error]", error);
      res.status(200).json({ received: true });
    }
  };

  /**
   * VNPay IPN — VNPay posts form-urlencoded data here when the payment
   * state changes server-side. In sandbox this is rarely used (we rely
   * on the browser return URL), but it works as a safety net for
   * production.
   */
  handleVNPayWebhook = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const rawBody =
        Buffer.isBuffer(req.body) && req.body.length > 0
          ? (req.body as Buffer)
          : Buffer.from(
              new URLSearchParams(req.body as Record<string, string>).toString(),
            );
      const signature =
        (req.body as Record<string, string>)?.vnp_SecureHash ?? "";

      await this.webhookService.handlePaymentWebhook(
        "vnpay",
        rawBody,
        signature,
      );

      // VNPay expects `RspCode=00` on success and `RspCode=01|02|...`
      // on rejected calls.
      res.set("Content-Type", "application/json");
      res.status(200).json({ RspCode: "00", Message: "OK" });
    } catch (error) {
      console.error("[VNPay Webhook Error]", error);
      res.status(200).json({ RspCode: "99", Message: "Unknown error" });
    }
  };
}
