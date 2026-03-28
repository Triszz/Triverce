"use strict";

exports.up = async (db) => {
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS inventory (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      variant_id     UUID NOT NULL UNIQUE REFERENCES product_variants(id) ON DELETE CASCADE,
      quantity       INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      reserved       INT NOT NULL DEFAULT 0 CHECK (reserved >= 0),
      created_at     TIMESTAMPTZ DEFAULT now(),
      updated_at     TIMESTAMPTZ DEFAULT now()
    );
  `);
};

exports.down = async (db) => {
  await db.runSql(`DROP TABLE IF EXISTS inventory;`);
};
