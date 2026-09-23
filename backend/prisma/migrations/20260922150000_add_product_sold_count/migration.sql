-- Migration: add_product_sold_count
-- Adds `sold_count` to `products` as a denormalised counter that tracks
-- cumulative delivered quantities per product.
-- Pre-existing products receive 0 (the column has @default(0)).
-- Existing order_items are NOT backfilled — the counter only increments
-- forward from the time this migration is applied.

BEGIN;

-- 1. Add the column with a default (no table rewrite on Postgres 11+ when
--    adding a non-nullable column with a constant default).
ALTER TABLE "products"
  ADD COLUMN "sold_count" integer NOT NULL DEFAULT 0;

-- 2. Index so catalog queries that sort by / filter on sold_count
--    (e.g. "best sellers" sort) don't full-scan.
CREATE INDEX "idx_products_sold_count" ON "products" ("sold_count");

COMMIT;
