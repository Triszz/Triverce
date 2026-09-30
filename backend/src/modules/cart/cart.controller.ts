import { Request, Response, NextFunction } from "express";
import { CartService } from "./cart.service";
import { AddCartItemDto, UpdateCartItemDto } from "./cart.dto";
import { BadRequestError } from "../../core/errors/AppError";

/*
 * Pure helper: validate that `:itemId` is a v1-5 UUID.
 *
 * Why here: the cart router was previously the only cart route missing
 * input validation on `:itemId`. A malformed value would slip through
 * to Prisma and surface as a 500 from the DB layer instead of the
 * expected 400. This helper throws the project's `BadRequestError`
 * class so the global error handler emits the same `success: false /
 * message` envelope that the cart DTO validation already produces — no
 * API-contract drift.
 *
 * Why not NestJS's `ParseUUIDPipe`: this service is plain Express (no
 * NestJS runtime), so we keep validation in the same idiom as the rest
 * of the module.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertUuidItemId(
  itemId: string | string[] | undefined,
): asserts itemId is string {
  if (typeof itemId !== "string" || !UUID_RE.test(itemId)) {
    throw new BadRequestError("Invalid cart item id: must be a UUID");
  }
}

export class CartController {
  constructor(private cartService: CartService) {}

  // Get cart
  getCart = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cart = await this.cartService.getCart(req.user!.userId);
      res.status(200).json({
        success: true,
        data: cart.toPublic(),
      });
    } catch (error) {
      next(error);
    }
  };

  // Add item to cart
  addItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cart = await this.cartService.addItem(
        req.user!.userId,
        req.body as AddCartItemDto,
      );
      res.status(201).json({
        success: true,
        data: cart.toPublic(),
      });
    } catch (error) {
      next(error);
    }
  };

  // Update item quantity from cart
  updateItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      assertUuidItemId(req.params.itemId);
      const cart = await this.cartService.updateItem(
        req.user!.userId,
        req.params.itemId,
        req.body as UpdateCartItemDto,
      );
      res.status(200).json({
        success: true,
        data: cart.toPublic(),
      });
    } catch (error) {
      next(error);
    }
  };

  // Remove 1 item from cart
  removeItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      assertUuidItemId(req.params.itemId);
      const cart = await this.cartService.removeItem(
        req.user!.userId,
        req.params.itemId,
      );
      res.status(200).json({
        success: true,
        data: cart.toPublic(),
      });
    } catch (error) {
      next(error);
    }
  };

  // Remove all items from cart (Clear cart)
  clearCart = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cart = await this.cartService.clearCart(req.user!.userId);
      res.status(200).json({
        success: true,
        data: cart.toPublic(),
      });
    } catch (error) {
      next(error);
    }
  };
}
