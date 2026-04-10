"use strict";

exports.up = async (db) => {
  // Cart table
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS carts (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status     VARCHAR(20) NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'checked_out', 'abandoned')),
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // cart_items table
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cart_id    UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
      variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
      quantity   INT NOT NULL CHECK (quantity > 0),
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),

      CONSTRAINT uq_cart_variant UNIQUE (cart_id, variant_id)
    );
  `);

  await db.runSql(`
    CREATE INDEX IF NOT EXISTS idx_carts_user_id
      ON carts(user_id);
    CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id
      ON cart_items(cart_id);

    CREATE UNIQUE INDEX IF NOT EXISTS uq_user_active_cart 
      ON carts(user_id) WHERE status = 'active';
  `);
};

exports.down = async (db) => {
  await db.runSql(`DROP TABLE IF EXISTS cart_items;`);
  await db.runSql(`DROP TABLE IF EXISTS carts;`);
};
