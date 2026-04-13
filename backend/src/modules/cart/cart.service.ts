import { CartRepository } from "./cart.repository";
import { InventoryRepository } from "../inventory/inventory.repository";
import { CartEntity } from "./cart.entity";
import { CartItemEntity } from "./cart-item.entity";
import { AddCartItemDto, UpdateCartItemDto } from "./cart.dto";
import { NotFoundError, BadRequestError } from "../../core/errors/AppError";

export class CartService {
  constructor(
    private cartRepository: CartRepository,
    private inventoryRepository: InventoryRepository,
  ) {}

  // View shopping cart - create if do not already have
  async getCart(userId: string): Promise<CartEntity> {
    return this.cartRepository.findOrCreate(userId);
  }

  // Add item to cart
  async addItem(userId: string, dto: AddCartItemDto): Promise<CartEntity> {
    // 1. Check inventory
    const inventory = await this.inventoryRepository.findByVariantId(
      dto.variantId,
    );
    if (!inventory)
      throw new NotFoundError(`Variant with id "${dto.variantId}" not found`);

    if (inventory.available < dto.quantity)
      throw new BadRequestError(
        `Not enough stock. Available: ${inventory.available}, Requested: ${dto.quantity}`,
      );

    // 2. Get or create cart
    const cart = await this.cartRepository.findOrCreate(userId);

    // 3. Check if variant existed in cart
    const existingItem = cart.items.find((i) => i.variantId === dto.variantId);
    const newTotal = (existingItem?.quantity ?? 0) + dto.quantity;

    if (inventory.available < newTotal)
      throw new BadRequestError(
        `Not enough stock. Available: ${inventory.available}, ` +
          `Already in cart: ${existingItem?.quantity ?? 0}, Requested: ${dto.quantity}`,
      );

    // 4. Reserve + upsert - rollback when error
    try {
      await this.cartRepository.client.transaction().execute(async (trx) => {
        await this.inventoryRepository.reserve(
          dto.variantId,
          dto.quantity,
          trx,
        );
        await this.cartRepository.upsertItem(
          cart.id,
          dto.variantId,
          dto.quantity,
          trx,
        );
      });
    } catch (error: any) {
      if (error.message === "INSUFFICIENT_STOCK")
        throw new BadRequestError(
          `Stock was just taken by another order. Available: ${inventory.available}`,
        );

      throw error;
    }

    // 5. Return the newest cart
    return (await this.cartRepository.findActiveByUserId(userId))!;
  }

  // Update item quantity from cart
  async updateItem(
    userId: string,
    cartItemId: string,
    dto: UpdateCartItemDto,
  ): Promise<CartEntity> {
    const cart = await this.cartRepository.findOrCreate(userId);

    // Check if the item belongs to the user's cart
    const item = cart.items.find((i) => i.id === cartItemId);
    if (!item)
      throw new NotFoundError(`Cart item with id "${cartItemId}" not found`);

    const diff = dto.quantity - item.quantity;
    // If nothing change
    if (diff === 0) return cart;

    if (diff > 0) {
      const inventory = await this.inventoryRepository.findByVariantId(
        item.variantId,
      );
      if (!inventory || inventory.available < diff)
        throw new BadRequestError(
          `Not enough stock. Available: ${inventory?.available ?? 0}, Need more: ${diff}`,
        );
    }

    try {
      await this.cartRepository.client.transaction().execute(async (trx) => {
        if (diff > 0) {
          await this.inventoryRepository.reserve(item.variantId, diff, trx);
        } else {
          await this.inventoryRepository.release(
            item.variantId,
            Math.abs(diff),
            trx,
          );
        }
        await this.cartRepository.updateItemQuantity(
          cart.id,
          cartItemId,
          dto.quantity,
          trx,
        );
      });
    } catch (error: any) {
      if (error.message === `INSUFFICIENT_STOCK`)
        throw new BadRequestError(
          `Stock was just taken by another order. Please try a smaller quantity`,
        );

      if (error.message === `RELEASE_FAILED`)
        throw new BadRequestError(`Release failed: reserved stock mismatch`);

      throw error;
    }

    return (await this.cartRepository.findActiveByUserId(userId))!;
  }

  // Remove 1 item from cart -> Release inventory
  async removeItem(userId: string, cartItemId: string): Promise<CartEntity> {
    const cart = await this.cartRepository.findOrCreate(userId);

    const item = cart.items.find((i) => i.id === cartItemId);
    if (!item)
      throw new NotFoundError(`Cart item with id "${cartItemId}" not found`);

    // Remove item + release
    try {
      await this.cartRepository.client.transaction().execute(async (trx) => {
        await this.cartRepository.removeItem(cart.id, cartItemId, trx);
        await this.inventoryRepository.release(
          item.variantId,
          item.quantity,
          trx,
        );
      });
    } catch (error: any) {
      if (error.message === `RELEASE_FAILED`)
        throw new BadRequestError(`Release failed: reserved stock mismatch`);

      throw error;
    }

    return (await this.cartRepository.findActiveByUserId(userId))!;
  }

  //Remove all items from cart (Clear cart) -> Release all
  async clearCart(userId: string): Promise<CartEntity> {
    const cart = await this.cartRepository.findOrCreate(userId);
    if (cart.items.length === 0) return cart;

    // Remove all items + release all reserved
    try {
      await this.cartRepository.client.transaction().execute(async (trx) => {
        for (const item of cart.items) {
          await this.inventoryRepository.release(
            item.variantId,
            item.quantity,
            trx,
          );
        }
        await this.cartRepository.clearItems(cart.id, trx);
      });
    } catch (error: any) {
      if (error.message === `RELEASE_FAILED`)
        throw new BadRequestError(`Release failed: reserved stock mismatch`);

      throw error;
    }

    return (await this.cartRepository.findActiveByUserId(userId))!;
  }
}
