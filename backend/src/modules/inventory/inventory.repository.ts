import { Kysely, Transaction } from "kysely";
import { DatabaseSchema } from "../../infrastructure/database/db.schema";
import { InventoryEntity } from "./inventory.entity";

type DbOrTrx = Kysely<DatabaseSchema> | Transaction<DatabaseSchema>;
export class InventoryRepository {
  constructor(private db: Kysely<DatabaseSchema>) {}

  // Find inventory of 1 variant
  async findByVariantId(variantId: string): Promise<InventoryEntity | null> {
    const row = await this.db
      .selectFrom("inventory")
      .selectAll()
      .where("variant_id", "=", variantId)
      .executeTakeFirst();

    return row ? InventoryEntity.fromDatabase(row) : null;
  }

  // Find inventories of 1 product
  async findByProductId(productId: string): Promise<InventoryEntity[]> {
    const rows = await this.db
      .selectFrom("inventory")
      .innerJoin(
        "product_variants",
        "product_variants.id",
        "inventory.variant_id",
      )
      .selectAll("inventory")
      .where("product_variants.product_id", "=", productId)
      .execute();

    return rows.map(InventoryEntity.fromDatabase);
  }

  // Set fixed quantity (in stock)
  async setQuantity(
    variantId: string,
    quantity: number,
  ): Promise<InventoryEntity> {
    const row = await this.db
      .updateTable("inventory")
      .set({
        quantity: quantity,
        updated_at: new Date(),
      })
      .where("variant_id", "=", variantId)
      .where("reserved", "<=", quantity)
      .returningAll()
      .executeTakeFirst();

    if (!row) throw new Error("CANNOT_SET_QUANTITY_BELOW_RESERVED");

    return InventoryEntity.fromDatabase(row);
  }

  // Inventory addition/subtraction (Adjust inventory)
  async adjustQuantity(
    variantId: string,
    delta: number,
  ): Promise<InventoryEntity> {
    const row = await this.db
      .updateTable("inventory")
      .set((eb) => ({
        quantity: eb("quantity", "+", delta),
        updated_at: new Date(),
      }))
      .where("variant_id", "=", variantId)
      .where((eb) => eb("quantity", ">=", eb("reserved", "-", delta)))
      .returningAll()
      .executeTakeFirst();

    // If null -> delta make quantity negative -> refuse
    if (!row) throw new Error("INSUFFICIENT_STOCK");

    return InventoryEntity.fromDatabase(row);
  }

  // Reserve when add in cart
  async reserve(
    variantId: string,
    qty: number,
    trx?: DbOrTrx,
  ): Promise<InventoryEntity> {
    const db = trx ?? this.db;
    const row = await db
      .updateTable("inventory")
      .set((eb) => ({
        reserved: eb("reserved", "+", qty),
        updated_at: new Date(),
      }))
      .where("variant_id", "=", variantId)
      .where((eb) => eb("quantity", ">=", eb("reserved", "+", qty)))
      .returningAll()
      .executeTakeFirst();

    if (!row) throw new Error("INSUFFICIENT_STOCK");

    return InventoryEntity.fromDatabase(row);
  }

  // Release reserve when delete from cart
  async release(
    variantId: string,
    qty: number,
    trx?: DbOrTrx,
  ): Promise<InventoryEntity> {
    const db = trx ?? this.db;
    const row = await db
      .updateTable("inventory")
      .set((eb) => ({
        reserved: eb("reserved", "-", qty),
        updated_at: new Date(),
      }))
      .where("variant_id", "=", variantId)
      .where((eb) => eb("reserved", ">=", qty))
      .returningAll()
      .executeTakeFirst();

    if (!row) throw new Error("RELEASE_FAILED");

    return InventoryEntity.fromDatabase(row);
  }
}
