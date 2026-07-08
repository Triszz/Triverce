import { PrismaClient, Prisma } from "@prisma/client";
import { CartEntity } from "./cart.entity";
import { CartItemEntity } from "./cart-item.entity";

/**
 * CartRepository — Prisma-backed.
 *
 * Public API unchanged:
 *   findActiveByUserId / findOrCreate / upsertItem / updateItemQuantity /
 *   removeItem / clearItems / findItemById
 *
 * Transactional methods accept `Prisma.TransactionClient` so they can be
 * invoked either standalone or inside `prisma.$transaction(async tx => …)`.
 * The `client` getter exists for service-level transactions and now
 * returns the underlying PrismaClient (which is itself a transaction-
 * capable object).
 */
export class CartRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Exposed for service-level transactions. Returns the PrismaClient,
   * which is itself a transaction-capable handle and accepts `tx`
   * delegates created via `prisma.$transaction(async tx => …)`.
   */
  get client(): PrismaClient {
    return this.prisma;
  }

  async findActiveByUserId(userId: string): Promise<CartEntity | null> {
    const cartRow = await this.prisma.cart.findFirst({
      where: { userId, status: "active" },
    });
    if (!cartRow) return null;

    const items = await this.loadItems(cartRow.id);
    return CartEntity.fromDatabase(cartRow, items);
  }

  async findOrCreate(userId: string): Promise<CartEntity> {
    const existing = await this.findActiveByUserId(userId);
    if (existing) return existing;

    const cartRow = await this.prisma.cart.create({
      data: { userId, status: "active" },
    });
    return CartEntity.fromDatabase(cartRow, []);
  }

  /**
   * Upsert pattern matching the original:
   *   INSERT … ON CONFLICT (uq_cart_variant) DO UPDATE SET
   *     quantity = quantity + ?, updated_at = now()
   *
   * Prisma `upsert` reads-then-writes; for a true atomic increment you
   * would use raw SQL. We keep the read-modify-write here to preserve
   * the original semantics within transactions.
   */
  async upsertItem(
    cartId: string,
    variantId: string,
    quantity: number,
    trx?: Prisma.TransactionClient,
  ): Promise<CartItemEntity> {
    const client = trx ?? this.prisma;
    const existing = await client.cartItem.findUnique({
      where: { cartId_variantId: { cartId, variantId } },
    });

    if (existing) {
      const row = await client.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
      });
      return CartItemEntity.fromRow(row);
    }

    try {
      const row = await client.cartItem.create({
        data: { cartId, variantId, quantity },
      });
      return CartItemEntity.fromRow(row);
    } catch (err) {
      // Concurrent insert: re-fetch and apply the increment.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const row = await client.cartItem.update({
          where: { cartId_variantId: { cartId, variantId } },
          data: { quantity: { increment: quantity } },
        });
        return CartItemEntity.fromRow(row);
      }
      throw err;
    }
  }

  async updateItemQuantity(
    cartId: string,
    cartItemId: string,
    quantity: number,
    trx?: Prisma.TransactionClient,
  ): Promise<CartItemEntity | null> {
    const client = trx ?? this.prisma;
    try {
      const row = await client.cartItem.update({
        where: { id: cartItemId },
        data: { quantity },
      });
      // Defensive: ensure item still belongs to the cart the caller passed.
      if (row.cartId !== cartId) return null;
      return CartItemEntity.fromRow(row);
    } catch {
      return null;
    }
  }

  async removeItem(
    cartId: string,
    cartItemId: string,
    trx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const client = trx ?? this.prisma;
    try {
      const item = await client.cartItem.findUnique({
        where: { id: cartItemId },
        select: { cartId: true },
      });
      if (!item || item.cartId !== cartId) return false;
      await client.cartItem.delete({ where: { id: cartItemId } });
      return true;
    } catch {
      return false;
    }
  }

  async clearItems(cartId: string, trx?: Prisma.TransactionClient): Promise<void> {
    const client = trx ?? this.prisma;
    await client.cartItem.deleteMany({ where: { cartId } });
  }

  async findItemById(cartItemId: string): Promise<CartItemEntity | null> {
    const row = await this.prisma.cartItem.findUnique({
      where: { id: cartItemId },
    });
    return row ? CartItemEntity.fromRow(row) : null;
  }

  private async loadItems(cartId: string): Promise<CartItemEntity[]> {
    const rows = await this.prisma.cartItem.findMany({
      where: { cartId },
      include: {
        variant: {
          include: { product: true, inventory: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return rows.map((row) =>
      CartItemEntity.fromDatabase({
        ...row,
        variantProduct: row.variant?.product ?? null,
        inventoryQuantity: row.variant?.inventory?.quantity,
        inventoryReserved: row.variant?.inventory?.reserved,
      }),
    );
  }
}
