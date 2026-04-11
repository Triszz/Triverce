import { Kysely } from "kysely";
import { DatabaseSchema } from "../../infrastructure/database/db.schema";
import { CartEntity } from "./cart.entity";
import { CartItemEntity } from "./cart-item.entity";

export class CartRepository {
  constructor(private db: Kysely<DatabaseSchema>) {}

  // Find cart active of user (with items information)
  async findActiveByUserId(userId: string): Promise<CartEntity | null> {
    const cartRow = await this.db
      .selectFrom("carts")
      .selectAll()
      .where("user_id", "=", userId)
      .where("status", "=", "active")
      .executeTakeFirst();

    if (!cartRow) return null;

    const items = await this.loadItems(cartRow.id);
    return CartEntity.fromDatabase(cartRow, items);
  }

  // Create new cart if not exists
  async findOrCreate(userId: string): Promise<CartEntity> {
    const existing = await this.findActiveByUserId(userId);
    if (existing) return existing;

    const cartRow = await this.db
      .insertInto("carts")
      .values({
        user_id: userId,
        status: "active",
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return CartEntity.fromDatabase(cartRow, []);
  }

  // Add item - if a variant already exists, add the number together
  async upsertItem(
    cartId: string,
    variantId: string,
    quantity: number,
  ): Promise<CartItemEntity> {
    const row = await this.db
      .insertInto("cart_items")
      .values({
        cart_id: cartId,
        variant_id: variantId,
        quantity: quantity,
      })
      .onConflict((oc) =>
        oc.constraint("uq_cart_variant").doUpdateSet((eb) => ({
          quantity: eb("cart_items.quantity", "+", quantity),
          updated_at: new Date(),
        })),
      )
      .returningAll()
      .executeTakeFirstOrThrow();

    return CartItemEntity.fromRow(row);
  }

  // Update item quantity from cart
  async updateItemQuantity(
    cartId: string,
    cartItemId: string,
    quantity: number,
  ): Promise<CartItemEntity | null> {
    const row = await this.db
      .updateTable("cart_items")
      .set({ quantity, updated_at: new Date() })
      .where("id", "=", cartItemId)
      .where("cart_id", "=", cartId)
      .returningAll()
      .executeTakeFirst();

    return row ? CartItemEntity.fromRow(row) : null;
  }

  // Remove 1 item from cart
  async removeItem(cartId: string, cartItemId: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom("cart_items")
      .where("id", "=", cartItemId)
      .where("cart_id", "=", cartId)
      .executeTakeFirst();

    return Number(result.numDeletedRows) > 0;
  }

  // Remove all items from cart (Clear cart)
  async clearItems(cartId: string): Promise<void> {
    await this.db
      .deleteFrom("cart_items")
      .where("cart_id", "=", cartId)
      .execute();
  }

  // Find item by id
  async findItemById(cartItemId: string): Promise<CartItemEntity | null> {
    const row = await this.db
      .selectFrom("cart_items")
      .selectAll()
      .where("id", "=", cartItemId)
      .executeTakeFirst();

    return row ? CartItemEntity.fromRow(row) : null;
  }
  // Helpers
  private async loadItems(cartId: string): Promise<CartItemEntity[]> {
    const rows = await this.db
      .selectFrom("cart_items")
      .innerJoin(
        "product_variants",
        "product_variants.id",
        "cart_items.variant_id",
      )
      .innerJoin("products", "products.id", "product_variants.product_id")
      .select([
        "cart_items.id",
        "cart_items.cart_id",
        "cart_items.variant_id",
        "cart_items.quantity",
        "cart_items.created_at",
        "cart_items.updated_at",
        "product_variants.sku as variant_sku",
        "product_variants.price as variant_price",
        "product_variants.image_url as variant_image_url",
        "products.name as product_name",
        "products.slug as product_slug",
      ])
      .where("cart_items.cart_id", "=", cartId)
      .orderBy("cart_items.created_at", "asc")
      .execute();

    return rows.map(CartItemEntity.fromDatabase);
  }
}
