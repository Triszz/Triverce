"use strict";

exports.up = async (db) => {
  // payments table
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS payments (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      amount          NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
      currency        VARCHAR(3) NOT NULL DEFAULT 'VND',
      status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded')),
      gateway         VARCHAR(20) NOT NULL
                      CHECK (gateway IN ('momo', 'stripe', 'vnpay', 'cod')),
      gateway_ref     VARCHAR(255),
      gateway_data    JSONB,
      idempotency_key VARCHAR(255) NOT NULL UNIQUE,
      created_at      TIMESTAMPTZ DEFAULT now(),
      updated_at      TIMESTAMPTZ DEFAULT now()
    );
  `);

  // webhook_events table
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS webhook_events (
      id           VARCHAR(255) PRIMARY KEY,
      gateway      VARCHAR(20)  NOT NULL,
      event_type   VARCHAR(100) NOT NULL,
      payload      JSONB        NOT NULL,
      processed_at TIMESTAMPTZ  DEFAULT now()
    );
  `);

  // Alter orders — add payment_id
  await db.runSql(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;
  `);

  // Indexes
  await db.runSql(`
    CREATE INDEX IF NOT EXISTS idx_payments_customer_id
      ON payments(customer_id);
    CREATE INDEX IF NOT EXISTS idx_payments_gateway_ref
      ON payments(gateway_ref);
    CREATE INDEX IF NOT EXISTS idx_payments_status
      ON payments(status);
    CREATE INDEX IF NOT EXISTS idx_orders_payment_id
      ON orders(payment_id);
  `);
};

exports.down = async (db) => {
  await db.runSql(`ALTER TABLE orders DROP COLUMN IF EXISTS payment_id;`);
  await db.runSql(`DROP TABLE IF EXISTS webhook_events;`);
  await db.runSql(`DROP TABLE IF EXISTS payments;`);
};
