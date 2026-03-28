"use strict";

exports.up = async (db) => {
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS categories (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(100) NOT NULL,
      slug        VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      parent_id   UUID REFERENCES categories(id) ON DELETE RESTRICT,
      is_active   BOOLEAN NOT NULL DEFAULT true,
      sort_order  INT NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ DEFAULT now(),
      updated_at  TIMESTAMPTZ DEFAULT now()
    );

     -- Tìm nhanh các danh mục con theo parent
    CREATE INDEX idx_categories_parent_id ON categories(parent_id);
  `);
};

exports.down = async (db) => {
  await db.runSql(`DROP TABLE IF EXISTS categories;`);
};
