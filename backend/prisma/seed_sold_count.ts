/**
 * prisma/seed_sold_count.ts — Test data filler for `products.sold_count`.
 *
 * One-off script. NOT registered in `package.json` — run with:
 *
 *     npx tsx prisma/seed_sold_count.ts
 *
 * What it does:
 *   • Counts every non-deleted product in the database.
 *   • Writes a random `sold_count` to each one, drawn from a small bucket
 *     (0, 50, 1200, 15500, 250000, 1500000) so we exercise every branch of
 *     `formatSold`:
 *
 *       0          → hidden
 *       50         → "50 Đã bán"
 *       1_200      → "1.2k Đã bán"
 *       15_500     → "15.5k Đã bán"
 *       250_000    → "250k Đã bán"
 *       1_500_000  → "1.5Tr Đã bán"
 *
 * Idempotent — running it again just re-rolls new random values.
 *
 * Why this exists:
 *   The `sold_count` column was added in `20260922150000_add_product_sold_count`
 *   and defaults to 0 for existing rows. The storefront hides `0` by design
 *   (Shopee/Tiki never render "0 Đã bán"). To verify the full pipeline —
 *   Prisma → entity → DTO → API → React → formatSold → DOM — we need rows
 *   with non-zero values. This script fills that gap without touching the
 *   canonical seed (which would lose product/variant/inventory fixtures).
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString:
      process.env.DATABASE_URL ?? process.env.DIRECT_URL ?? "",
  }),
  log: ["warn", "error"],
});

// Six buckets, one per formatSold() branch (plus the hidden-0 branch).
const SOLD_BUCKETS = [0, 50, 1_200, 15_500, 250_000, 1_500_000];

async function main(): Promise<void> {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, soldCount: true },
  });

  if (products.length === 0) {
    console.log("[seed_sold_count] No products found — nothing to update.");
    return;
  }

  console.log(
    `[seed_sold_count] Found ${products.length} active products. Rolling random sold_count…`,
  );

  let updated = 0;
  for (const p of products) {
    const next = SOLD_BUCKETS[Math.floor(Math.random() * SOLD_BUCKETS.length)] ?? 0;
    await prisma.product.update({
      where: { id: p.id },
      data: { soldCount: next },
    });
    updated += 1;
    console.log(`  • ${p.name.slice(0, 40).padEnd(40)}  →  ${next}`);
  }

  console.log(`[seed_sold_count] Done. Updated ${updated} products.`);
}

main()
  .catch((err) => {
    console.error("[seed_sold_count] Failed:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
