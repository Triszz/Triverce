"use strict";

exports.up = async (db) => {
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS products (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
      name        VARCHAR(255) NOT NULL,
      slug        VARCHAR(255) UNIQUE NOT NULL,
      description TEXT,
      base_price  NUMERIC(12, 2) NOT NULL CHECK (base_price >= 0),
      is_active   BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ DEFAULT now(),
      updated_at  TIMESTAMPTZ DEFAULT now()
    );

    -- Filter sản phẩm theo danh mục
    CREATE INDEX idx_products_category_id ON products(category_id);

    -- Filter sản phẩm đang active 
    CREATE INDEX idx_products_is_active   ON products(is_active);
  `);
};

exports.down = async (db) => {
  await db.runSql(`DROP TABLE IF EXISTS products;`);
};
