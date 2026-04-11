import { Request, Response, NextFunction } from "express";
import { CartService } from "./cart.service";
import { AddCartItemDto, UpdateCartItemDto } from "./cart.dto";

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
      const cart = await this.cartService.updateItem(
        req.user!.userId,
        req.params.itemId as string,
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
      const cart = await this.cartService.removeItem(
        req.user!.userId,
        req.params.itemId as string,
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
