import { InventoryEntity } from "./inventory.entity";
import { InventoryRepository } from "./inventory.repository";
import { ProductRepository } from "../product/product.repository";
import { UpdateInventoryDto, AdjustInventoryDto } from "./inventory.dto";
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from "../../core/errors/AppError";

export class InventoryService {
  constructor(
    private inventoryRepository: InventoryRepository,
    private productRepository: ProductRepository,
  ) {}

  // Get inventory by variant id
  async getByVariantId(variantId: string): Promise<InventoryEntity> {
    const inventory = await this.inventoryRepository.findByVariantId(variantId);
    if (!inventory)
      throw new NotFoundError(
        `Inventory for variant with id "${variantId}" not found`,
      );
    return inventory;
  }

  // Get inventory of 1 product
  async getByProductId(productId: string): Promise<InventoryEntity[]> {
    const product = await this.productRepository.findById(productId);
    if (!product)
      throw new NotFoundError(`Product with id "${productId}" not found`);
    return this.inventoryRepository.findByProductId(productId);
  }

  // Set fixed quantity - only for seller or admin
  async setQuantity(
    variantId: string,
    dto: UpdateInventoryDto,
    user: { userId: string; role: string },
  ): Promise<InventoryEntity> {
    await this.verifyVariantOwnership(variantId, user);
    try {
      return this.inventoryRepository.setQuantity(variantId, dto.quantity);
    } catch (error: any) {
      if (error.message === "CANNOT_SET_QUANTITY_BELOW_RESERVED") {
        throw new BadRequestError(
          "Cannot set quantity below the currently reserved amount in active carts.",
        );
      }
      throw error;
    }
  }

  // Adjust inventory (addition/subtraction)
  async adjustQuantity(
    variantId: string,
    dto: AdjustInventoryDto,
    user: { userId: string; role: string },
  ): Promise<InventoryEntity> {
    await this.verifyVariantOwnership(variantId, user);

    try {
      return await this.inventoryRepository.adjustQuantity(
        variantId,
        dto.delta,
      );
    } catch (error: any) {
      if (error.message === "INSUFFICIENT_STOCK") {
        throw new BadRequestError("Adjustment would make quantity negative");
      }
      throw error;
    }
  }

  // Reserve when add in cart
  async reserve(variantId: string, qty: number): Promise<void> {
    try {
      await this.inventoryRepository.reserve(variantId, qty);
    } catch (error: any) {
      if (error.message === "INSUFFICIENT_STOCK") {
        throw new BadRequestError("Not enough stock available");
      }
      throw error;
    }
  }

  // Release reserve when delete from cart
  async release(variantId: string, qty: number): Promise<void> {
    try {
      await this.inventoryRepository.release(variantId, qty);
    } catch (error: any) {
      if (error.message === "RELEASE_FAILED") {
        throw new BadRequestError("Release failed: reserved stock mismatch");
      }
      throw error;
    }
  }

  // Helpers
  private async verifyVariantOwnership(
    variantId: string,
    user: { userId: string; role: string },
  ): Promise<void> {
    if (user.role === "admin") return;

    // Find product obtain this variant
    const row = await this.inventoryRepository.findByVariantId(variantId);
    if (!row)
      throw new NotFoundError(`Variant with id "${variantId}" not found`);

    const sellerId =
      await this.productRepository.getSellerIdByVariantId(variantId);

    if (!sellerId) {
      throw new NotFoundError(`Variant with id "${variantId}" not found`);
    }

    if (sellerId !== user.userId) {
      throw new ForbiddenError(
        "You do not have permission to modify this inventory",
      );
    }
  }
}
