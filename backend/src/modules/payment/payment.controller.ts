import { Request, Response, NextFunction } from "express";
import { PaymentService } from "./payment.service";
import { BadRequestError } from "../../core/errors/AppError";

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

  /**
   * POST /payments/:paymentId/vnpay-return
   *
   * The frontend's PaymentReturnPage posts the raw `vnp_*` query params
   * it received from VNPay. We verify the signature, update the payment
   * status, and return the canonical public record so the page can stop
   * polling.
   */
  vnpayReturn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.body || typeof req.body !== "object") {
        throw new BadRequestError(
          "Expected VNPay params in JSON body (key/value pairs)",
        );
      }
      const params = req.body as Record<string, string>;
      const result = await this.paymentService.handleVnpayReturn(
        req.params.paymentId as string,
        req.user!.userId,
        params,
      );
      res.status(200).json({
        success: true,
        data: {
          valid: result.valid,
          status: result.status,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
