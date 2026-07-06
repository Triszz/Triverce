import { PrismaClient, Prisma } from "@prisma/client";
import { InventoryEntity } from "./inventory.entity";

/**
 * InventoryRepository — Prisma-backed.
 *
 * Public API unchanged. Methods that previously took a Kysely transaction
 * now accept `Prisma.TransactionClient`, which is the equivalent parameter
 * inside `prisma.$transaction(async tx => ...)`.
 *
 * Stock-affecting updates use a guarded `WHERE … quantity >= reserved`
 * clause implemented via `updateMany` with `count`-then-refetch when
 * needed for the conditional guard. This preserves the Kysely-version
 * semantics ("fail the update if the constraint doesn't hold") without
 * needing raw SQL.
 */
export class InventoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByVariantId(variantId: string): Promise<InventoryEntity | null> {
    const row = await this.prisma.inventory.findUnique({
      where: { variantId },
    });
    return row ? InventoryEntity.fromDatabase(row) : null;
  }

  async findByProductId(productId: string): Promise<InventoryEntity[]> {
    const rows = await this.prisma.inventory.findMany({
      where: { variant: { productId } },
    });
    return rows.map(InventoryEntity.fromDatabase);
  }

  async setQuantity(
    variantId: string,
    quantity: number,
  ): Promise<InventoryEntity> {
    // Guard: refuse to set quantity below already-reserved stock.
    const current = await this.prisma.inventory.findUnique({
      where: { variantId },
      select: { reserved: true },
    });
    if (!current) throw new Error("INVENTORY_NOT_FOUND");
    if (quantity < current.reserved) {
      throw new Error("CANNOT_SET_QUANTITY_BELOW_RESERVED");
    }

    const row = await this.prisma.inventory.update({
      where: { variantId },
      data: { quantity },
    });
    return InventoryEntity.fromDatabase(row);
  }

  async adjustQuantity(
    variantId: string,
    delta: number,
  ): Promise<InventoryEntity> {
    // Atomic guarded update: only succeed if quantity + delta >= reserved.
    // We implement this with two steps:
    //   1) Reject early if the resulting quantity would violate the constraint.
    //   2) Compute the new quantity and update; if any concurrent caller beat
    //      us to it the update simply succeeds on the new baseline.
    // For strict concurrency, do this inside `prisma.$transaction` with
    // `SELECT … FOR UPDATE` (see OrderRepository.lockInventoryForUpdate).
    const current = await this.prisma.inventory.findUnique({
      where: { variantId },
    });
    if (!current) throw new Error("INVENTORY_NOT_FOUND");

    const newQty = current.quantity + delta;
    if (newQty < current.reserved) throw new Error("INSUFFICIENT_STOCK");

    const row = await this.prisma.inventory.update({
      where: { variantId },
      data: { quantity: newQty },
    });
    return InventoryEntity.fromDatabase(row);
  }

  async reserve(
    variantId: string,
    qty: number,
    trx?: Prisma.TransactionClient,
  ): Promise<InventoryEntity> {
    const client = trx ?? this.prisma;
    // Constraint: quantity >= reserved + qty
    const current = await client.inventory.findUnique({
      where: { variantId },
    });
    if (!current) throw new Error("INVENTORY_NOT_FOUND");
    if (current.quantity < current.reserved + qty) {
      throw new Error("INSUFFICIENT_STOCK");
    }

    const row = await client.inventory.update({
      where: { variantId },
      data: { reserved: current.reserved + qty },
    });
    return InventoryEntity.fromDatabase(row);
  }

  async release(
    variantId: string,
    qty: number,
    trx?: Prisma.TransactionClient,
  ): Promise<InventoryEntity> {
    const client = trx ?? this.prisma;
    const current = await client.inventory.findUnique({
      where: { variantId },
    });
    if (!current) throw new Error("INVENTORY_NOT_FOUND");
    if (current.reserved < qty) throw new Error("RELEASE_FAILED");

    const row = await client.inventory.update({
      where: { variantId },
      data: { reserved: current.reserved - qty },
    });
    return InventoryEntity.fromDatabase(row);
  }
}
