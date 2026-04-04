"use strict";

exports.up = async (db) => {
  await db.runSql(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS seller_id UUID NOT NULL
      REFERENCES users(id) ON DELETE RESTRICT;
  `);

  await db.runSql(`
    CREATE INDEX IF NOT EXISTS idx_products_seller_id
      ON products(seller_id);
  `);
};

exports.down = async (db) => {
  await db.runSql(`
    DROP INDEX IF EXISTS idx_products_seller_id;
  `);

  await db.runSql(`
    ALTER TABLE products
    DROP COLUMN IF EXISTS seller_id;
  `);
};
