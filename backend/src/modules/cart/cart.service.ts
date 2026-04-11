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

    // 4. Add to cart (upsert)
    await this.cartRepository.upsertItem(cart.id, dto.variantId, dto.quantity);

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

    // Check inventory with new quantity
    const inventory = await this.inventoryRepository.findByVariantId(
      item.variantId,
    );
    if (!inventory || inventory.available < dto.quantity)
      throw new BadRequestError(
        `Not enough stock. Available: ${inventory?.available ?? 0}`,
      );

    await this.cartRepository.updateItemQuantity(
      cart.id,
      cartItemId,
      dto.quantity,
    );

    return (await this.cartRepository.findActiveByUserId(userId))!;
  }

  // Remove 1 item from cart
  async removeItem(userId: string, cartItemId: string): Promise<CartEntity> {
    const cart = await this.cartRepository.findOrCreate(userId);

    const item = cart.items.find((i) => i.id === cartItemId);
    if (!item)
      throw new NotFoundError(`Cart item with id "${cartItemId}" not found`);

    await this.cartRepository.removeItem(cart.id, cartItemId);

    return (await this.cartRepository.findActiveByUserId(userId))!;
  }

  //Remove all items from cart (Clear cart)
  async clearCart(userId: string): Promise<CartEntity> {
    const cart = await this.cartRepository.findOrCreate(userId);
    await this.cartRepository.clearItems(cart.id);
    return (await this.cartRepository.findActiveByUserId(userId))!;
  }
}
