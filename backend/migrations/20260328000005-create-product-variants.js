"use strict";

exports.up = async (db) => {
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS product_variants (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      sku        VARCHAR(100) UNIQUE NOT NULL,
      price      NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
      image_url  TEXT,
      is_active  BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    -- Query tất cả variants của 1 product
    CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
  `);
};

exports.down = async (db) => {
  await db.runSql(`DROP TABLE IF EXISTS product_variants;`);
};
