/**
 * prisma-cleanup-duplicates.ts
 *
 * One-shot script to fix duplicate image URLs that crept into the `images[]`
 * column via flawed seed / migration logic.
 *
 * What it fixes:
 *   • Identical URLs appearing more than once in a single product's `images[]`.
 *     Run this script after deploying the deduplication fix in `ProductEntity.
 *     getEffectiveImages()` — it cleans the existing bad rows; the entity fix
 *     prevents future duplicates from being returned to clients.
 *
 * Run:
 *   npx ts-node prisma/prisma-cleanup-duplicates.ts
 *
 * Dry-run (safe — prints what would change without writing):
 *   npx ts-node prisma/prisma-cleanup-duplicates.ts --dry-run
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

async function deduplicateImages() {
  console.log(`[${dryRun ? "DRY RUN" : "LIVE"}] Scanning products for duplicate image URLs…`);

  const rows = await prisma.$queryRaw<{ id: string; images: string[] }[]>`
    SELECT id, images
    FROM products
    WHERE deleted_at IS NULL
      AND images IS NOT NULL
      AND jsonb_typeof(images) = 'array'
      AND jsonb_array_length(images) > 1
  `;

  console.log(`[${dryRun ? "DRY RUN" : "LIVE"}] Found ${rows.length} product(s) to check.`);
  let fixed = 0;

  for (const row of rows) {
    const images: unknown = row.images;
    if (!Array.isArray(images)) continue;

    const seen = new Set<string>();
    const deduped: string[] = [];
    let hadDuplicate = false;

    for (const url of images) {
      if (typeof url !== "string" || !url) continue;
      if (seen.has(url)) {
        hadDuplicate = true;
        continue;
      }
      seen.add(url);
      deduped.push(url);
    }

    if (!hadDuplicate) continue;

    console.log(
      `  ${dryRun ? "[DRY RUN] Would fix" : "[FIX]"}  product ${row.id}: ${images.length} → ${deduped.length} images`,
    );
    if (!dryRun) {
      await prisma.$executeRaw`
        UPDATE products
        SET images     = ${deduped}::jsonb,
            updated_at = NOW()
        WHERE id = ${row.id}::uuid
      `;
    }
    fixed++;
  }

  console.log(
    `Done. ${dryRun ? "Would fix" : "Fixed"} ${fixed} product(s).`,
  );
}

deduplicateImages()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error("Script failed:", err);
    return prisma.$disconnect().then(() => process.exit(1));
  });
