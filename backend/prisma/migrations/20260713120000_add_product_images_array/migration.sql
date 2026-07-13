-- Add Product gallery images array.
--
-- Decision: use PostgreSQL's native text[] rather than a join table.
--   • Easier to expose as a single API field.
--   • Order is preserved (the storefront treats element 0 as the
--     "main" image).
--   • No join queries on the hot read path.
--
-- Element [0] of `images` is the primary/thumbnail image by convention.
ALTER TABLE "products" ADD COLUMN "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
