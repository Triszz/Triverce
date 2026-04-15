"use strict";

exports.up = async (db) => {
  // orders table
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS orders (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      seller_id        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'confirmed', 'shipping', 'delivered', 'cancelled')),
      total_amount     NUMERIC(15, 2) NOT NULL CHECK (total_amount >= 0),

      shipping_name    VARCHAR(255) NOT NULL,
      shipping_phone   VARCHAR(20)  NOT NULL,
      shipping_address TEXT         NOT NULL,

      note             TEXT,
      cancelled_reason TEXT,
      created_at       TIMESTAMPTZ DEFAULT now(),
      updated_at       TIMESTAMPTZ DEFAULT now()
    );
  `);

  // order_items table
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS order_items (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      variant_id   UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
      quantity     INT NOT NULL CHECK (quantity > 0),
      unit_price   NUMERIC(15, 2) NOT NULL CHECK (unit_price >= 0),
      product_name VARCHAR(255) NOT NULL,
      variant_sku  VARCHAR(100) NOT NULL,
      created_at   TIMESTAMPTZ DEFAULT now()
    );
  `);

  // order_status_logs
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS order_status_logs (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      from_status VARCHAR(20),
      to_status   VARCHAR(20) NOT NULL,
      changed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      note        TEXT,
      created_at  TIMESTAMPTZ DEFAULT now()
    );
  `);

  // Indexes
  await db.runSql(`
    CREATE INDEX IF NOT EXISTS idx_orders_customer_id
      ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_seller_id   
      ON orders(seller_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status
      ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id
      ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_status_logs_order_id
      ON order_status_logs(order_id);
  `);
};

exports.down = async (db) => {
  await db.runSql(`DROP TABLE IF EXISTS order_status_logs;`);
  await db.runSql(`DROP TABLE IF EXISTS order_items;`);
  await db.runSql(`DROP TABLE IF EXISTS orders;`);
};
