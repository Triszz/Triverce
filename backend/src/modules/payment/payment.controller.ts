import { Request, Response, NextFunction } from "express";
import { PaymentService } from "./payment.service";

export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  // Create payment session or retry
  retrySession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { returnUrl, cancelUrl } = req.body;
      const result = await this.paymentService.createPaymentSession(
        req.params.paymentId as string,
        req.user!.userId,
        { returnUrl, cancelUrl },
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Verify status (Use when user redirect from MoMo)
  verify = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.paymentService.verifyStatus(
        req.params.paymentId as string,
        req.user!.userId,
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  confirmCOD = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.paymentService.confirmCOD(
        req.params.paymentId as string,
        req.user!.userId,
      );
      res.status(200).json({ success: true, message: "COD confirmed" });
    } catch (error) {
      next(error);
    }
  };
}
