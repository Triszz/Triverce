import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { CartRepository } from "./cart.repository";
import { InventoryRepository } from "../inventory/inventory.repository";
import { CartEntity } from "./cart.entity";
import { AddCartItemDto, UpdateCartItemDto } from "./cart.dto";
import { NotFoundError, BadRequestError } from "../../core/errors/AppError";

/**
 * CartService — Prisma-aware.
 *
 * The four operations that previously used `cartRepository.client.transaction()`
 * now use `prisma.$transaction(async tx => …)`. The `tx` parameter passed
 * into repository methods is `Prisma.TransactionClient` and is the
 * Prisma equivalent of Kysely's transaction handle.
 */
export class CartService {
  constructor(
    private cartRepository: CartRepository,
    private inventoryRepository: InventoryRepository,
    private prisma: PrismaClient,
  ) {}

  async getCart(userId: string): Promise<CartEntity> {
    return this.cartRepository.findOrCreate(userId);
  }

  async addItem(userId: string, dto: AddCartItemDto): Promise<CartEntity> {
    const inventory = await this.inventoryRepository.findByVariantId(
      dto.variantId,
    );
    if (!inventory)
      throw new NotFoundError(`Variant with id "${dto.variantId}" not found`);

    if (inventory.available < dto.quantity)
      throw new BadRequestError(
        `Not enough stock. Available: ${inventory.available}, Requested: ${dto.quantity}`,
      );

    const cart = await this.cartRepository.findOrCreate(userId);

    const existingItem = cart.items.find((i) => i.variantId === dto.variantId);
    const newTotal = (existingItem?.quantity ?? 0) + dto.quantity;

    if (inventory.available < newTotal)
      throw new BadRequestError(
        `Not enough stock. Available: ${inventory.available}, ` +
          `Already in cart: ${existingItem?.quantity ?? 0}, Requested: ${dto.quantity}`,
      );

    try {
      await this.prisma.$transaction(async (trx) => {
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
      if (error?.message === "INSUFFICIENT_STOCK")
        throw new BadRequestError(
          `Stock was just taken by another order. Available: ${inventory.available}`,
        );
      throw error;
    }

    return (await this.cartRepository.findActiveByUserId(userId))!;
  }

  async updateItem(
    userId: string,
    cartItemId: string,
    dto: UpdateCartItemDto,
  ): Promise<CartEntity> {
    const cart = await this.cartRepository.findOrCreate(userId);
    const item = cart.items.find((i) => i.id === cartItemId);
    if (!item)
      throw new NotFoundError(`Cart item with id "${cartItemId}" not found`);

    const isVariantChange = dto.variantId !== undefined && dto.variantId !== item.variantId;

    if (isVariantChange) {
      // TypeScript narrows `dto.variantId` to `string` inside this block.
      const newVariantId = dto.variantId as string;
      /*
       * Variant swap path:
       *   • Validate new variant exists and has stock.
       *   • Swap within a transaction: release old, reserve new, update FK.
       *   • If quantity also changed, apply the qty delta on the new variant.
       */
      const newInventory = await this.inventoryRepository.findByVariantId(
        newVariantId,
      );
      if (!newInventory)
        throw new NotFoundError(`Variant with id "${newVariantId}" not found`);
      if (!newInventory.available)
        throw new BadRequestError("The selected variant is out of stock");

      try {
        await this.prisma.$transaction(async (trx) => {
          // Release the old variant's reservation.
          await this.inventoryRepository.release(item.variantId, item.quantity, trx);
          // Reserve the new variant.
          await this.inventoryRepository.reserve(newVariantId, item.quantity, trx);
          // Swap the FK on the cart item.
          await this.cartRepository.swapItemVariant(
            cart.id,
            cartItemId,
            item.variantId,
            newVariantId,
            trx,
          );
          // If quantity also changed, update it on the new variant.
          if (dto.quantity !== item.quantity) {
            await this.cartRepository.updateItemQuantity(
              cart.id,
              cartItemId,
              dto.quantity,
              trx,
            );
          }
        });
      } catch (error: any) {
        if (error?.message === "INSUFFICIENT_STOCK")
          throw new BadRequestError("Not enough stock available for the selected variant");
        if (error?.message === "RELEASE_FAILED")
          throw new BadRequestError("Failed to release stock from the previous variant");
        throw error;
      }

      return (await this.cartRepository.findActiveByUserId(userId))!;
    }

    /*
     * Quantity-only path (original behaviour, preserved).
     */
    const diff = dto.quantity - item.quantity;
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
      await this.prisma.$transaction(async (trx) => {
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
      if (error?.message === "INSUFFICIENT_STOCK")
        throw new BadRequestError(
          `Stock was just taken by another order. Please try a smaller quantity`,
        );
      if (error?.message === "RELEASE_FAILED")
        throw new BadRequestError(`Release failed: reserved stock mismatch`);
      throw error;
    }

    return (await this.cartRepository.findActiveByUserId(userId))!;
  }

  async removeItem(userId: string, cartItemId: string): Promise<CartEntity> {
    const cart = await this.cartRepository.findOrCreate(userId);
    const item = cart.items.find((i) => i.id === cartItemId);
    if (!item)
      throw new NotFoundError(`Cart item with id "${cartItemId}" not found`);

    /*
     * Resilient delete:
     *
     * The original implementation surfaced any 4xx-style failure as a
     * `BadRequestError`, which broke the cart UI whenever the inventory
     * side of the relationship drifted out of sync with the cart side
     * (a real-world failure mode we've seen at least once — see the
     * `78bf89e6-…` incident where `inventory.reserved` no longer matched
     * the cart item's `quantity`).
     *
     * Three failure modes are now each handled individually:
     *
     *   1. cartItem already gone (`P2025`): the user's intent ("this
     *      item is no longer in my cart") is already satisfied. Swallow
     *      the error and return the current cart. This is the textbook
     *      idempotent-delete pattern.
     *
     *   2. The variant / inventory row has been hard-deleted: the
     *      release step throws `INVENTORY_NOT_FOUND`. We log a warning
     *      and continue — the cart item itself is still deletable, and
     *      we have nothing to release anyway.
     *
     *   3. `RELEASE_FAILED` (`reserved < qty`): a real drift between
     *      inventory.reserved and the cart item's quantity. We log the
     *      drift with the offending values for ops to investigate, but
     *      still proceed with the cart-item delete. The user's intent
     *      is to remove the row from their cart, and the reserved-
     *      underflow is not their fault — bouncing the request as a
     *      400 only punishes them for an upstream inconsistency.
     */
    let deleteOk = false;
    let releaseSkippedReason: string | null = null;

    try {
      await this.prisma.$transaction(async (trx) => {
        try {
          await trx.cartItem.delete({ where: { id: cartItemId } });
          deleteOk = true;
        } catch (err) {
          // P2025 — the row was already deleted by another request
          // (or a previous attempt). Treat as success; nothing to undo.
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2025"
          ) {
            deleteOk = true;
            return;
          }
          throw err;
        }

        try {
          await this.inventoryRepository.release(
            item.variantId,
            item.quantity,
            trx,
          );
        } catch (releaseErr: unknown) {
          const msg =
            releaseErr instanceof Error ? releaseErr.message : String(releaseErr);

          if (msg === "INVENTORY_NOT_FOUND") {
            // Variant or its inventory row was hard-deleted. Nothing
            // to release, nothing to compensate for.
            releaseSkippedReason =
              "inventory row missing — release skipped";
            console.warn(
              `[cart.removeItem] inventory row missing for variantId=${item.variantId}; ` +
                `cartItemId=${cartItemId} deleted without stock release.`,
            );
            return;
          }

          if (msg === "RELEASE_FAILED") {
            // Reserved-stock drift. Log and proceed — the cart item is
            // gone, which is what the user asked for.
            releaseSkippedReason =
              "reserved stock drift — release skipped, drift logged";
            console.warn(
              `[cart.removeItem] RELEASE_FAILED cartItemId=${cartItemId} ` +
                `variantId=${item.variantId} requestedRelease=${item.quantity}. ` +
                `Inventory reserved is lower than the cart item's quantity. ` +
                `Investigate drift; user-facing delete still succeeded.`,
            );
            return;
          }

          throw releaseErr;
        }
      });
    } catch (error: unknown) {
      // Anything that isn't a known recoverable case bubbles up. We
      // intentionally don't translate this to BadRequestError anymore —
      // the recoverable cases are handled inside the transaction.
      throw error;
    }

    // deleteOk is `true` if either the row was deleted or it was
    // already gone (P2025). Either way the caller's intent is met.
    if (!deleteOk) {
      // Defensive: shouldn't be reachable given the catches above, but
      // a future regression shouldn't silently misreport.
      throw new BadRequestError(
        `Failed to remove cart item ${cartItemId}` +
          (releaseSkippedReason ? ` (${releaseSkippedReason})` : ""),
      );
    }

    return (await this.cartRepository.findActiveByUserId(userId))!;
  }

  async clearCart(userId: string): Promise<CartEntity> {
    const cart = await this.cartRepository.findOrCreate(userId);
    if (cart.items.length === 0) return cart;

    /*
     * Same resilience rules as `removeItem`: a single drifted row must
     * not block the user from clearing the rest of their cart. We
     * iterate item-by-item inside one transaction and skip the two
     * known recoverable cases per row.
     */
    await this.prisma.$transaction(async (trx) => {
      for (const item of cart.items) {
        try {
          await trx.cartItem.delete({ where: { id: item.id } });
        } catch (err) {
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2025"
          ) {
            continue;
          }
          throw err;
        }

        try {
          await this.inventoryRepository.release(
            item.variantId,
            item.quantity,
            trx,
          );
        } catch (releaseErr: unknown) {
          const msg =
            releaseErr instanceof Error
              ? releaseErr.message
              : String(releaseErr);

          if (msg === "INVENTORY_NOT_FOUND") {
            console.warn(
              `[cart.clearCart] inventory row missing for variantId=${item.variantId}; ` +
                `cartItemId=${item.id} deleted without stock release.`,
            );
            continue;
          }

          if (msg === "RELEASE_FAILED") {
            console.warn(
              `[cart.clearCart] RELEASE_FAILED cartItemId=${item.id} ` +
                `variantId=${item.variantId} requestedRelease=${item.quantity}. ` +
                `Continuing with the rest of the cart.`,
            );
            continue;
          }

          throw releaseErr;
        }
      }
    });

    return (await this.cartRepository.findActiveByUserId(userId))!;
  }
}
