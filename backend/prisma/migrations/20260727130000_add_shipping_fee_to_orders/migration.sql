-- Add the `shipping_fee` column to orders with a sensible default.
-- `DEFAULT 0` means existing rows (placed before this migration)
-- show free shipping, which is the correct conservative assumption for
-- orders that were already completed without a shipping fee record.
ALTER TABLE "orders" ADD COLUMN "shipping_fee" DECIMAL(15, 2) NOT NULL DEFAULT 0;
