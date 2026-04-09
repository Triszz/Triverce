import { Request, Response, NextFunction } from "express";
import { InventoryService } from "./inventory.service";
import { UpdateInventoryDto, AdjustInventoryDto } from "./inventory.dto";

export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  // Get inventory of 1 variant
  getByVariantId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const inventory = await this.inventoryService.getByVariantId(
        req.params.variantId as string,
      );
      res.status(200).json({
        success: true,
        data: inventory.toPublic(),
      });
    } catch (error) {
      next(error);
    }
  };

  // Get inventories of 1 product
  getByProductId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const inventories = await this.inventoryService.getByProductId(
        req.params.productId as string,
      );
      res.status(200).json({
        success: true,
        data: inventories.map((i) => i.toPublic()),
      });
    } catch (error) {
      next(error);
    }
  };

  // Set fixed quantity
  setQuantity = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const inventory = await this.inventoryService.setQuantity(
        req.params.variantId as string,
        req.body as UpdateInventoryDto,
        req.user!,
      );
      res.status(200).json({
        success: true,
        data: inventory.toPublic(),
      });
    } catch (error) {
      next(error);
    }
  };

  // Adjust quantity (addition/subtraction)
  adjustQuantity = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const inventory = await this.inventoryService.adjustQuantity(
        req.params.variantId as string,
        req.body as AdjustInventoryDto,
        req.user!,
      );
      res.status(200).json({
        success: true,
        data: inventory.toPublic(),
      });
    } catch (error) {
      next(error);
    }
  };
}
