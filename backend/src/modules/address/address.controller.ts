import { Request, Response, NextFunction } from "express";
import { UserAddressService } from "./address.service";
import { UnauthorizedError, BadRequestError } from "../../core/errors/AppError";

export class UserAddressController {
  constructor(private addressService: UserAddressService) {}

  /**
   * GET /api/user/addresses
   *
   * Returns all saved addresses for the authenticated user.
   */
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new UnauthorizedError("Authentication required");

      const addresses = await this.addressService.listForUser(req.user.userId);
      res.status(200).json({ success: true, data: addresses });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/user/addresses
   *
   * Creates a new saved address. `isDefault` is optional — when omitted
   * the new address is not set as default. If `isDefault` is true, any
   * existing default is cleared automatically (see repository).
   */
  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new UnauthorizedError("Authentication required");

      const { recipientName, phone, address, isDefault } = req.body as {
        recipientName?: string;
        phone?: string;
        address?: string;
        isDefault?: boolean;
      };

      if (!recipientName || !phone || !address) {
        throw new BadRequestError(
          "recipientName, phone, and address are required",
        );
      }

      const address_ = await this.addressService.createForUser(req.user.userId, {
        recipientName,
        phone,
        address,
        isDefault,
      });

      res.status(201).json({ success: true, data: address_ });
    } catch (error) {
      next(error);
    }
  };
}
