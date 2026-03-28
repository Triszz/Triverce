"use strict";

exports.up = async (db) => {
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS product_attributes (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name       VARCHAR(50) UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at  TIMESTAMPTZ DEFAULT now()
    );

    -- Seed dữ liệu mặc định — các attribute phổ biến nhất
    INSERT INTO product_attributes (name) VALUES
      ('color'),
      ('size'),
      ('material')
    ON CONFLICT (name) DO NOTHING;
  `);
};

exports.down = async (db) => {
  await db.runSql(`DROP TABLE IF EXISTS product_attributes;`);
};
