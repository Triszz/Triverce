"use strict";

exports.up = async (db) => {
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS users (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email         VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role          VARCHAR(20) NOT NULL DEFAULT 'customer'
                    CHECK (role IN ('customer', 'admin', 'seller')),
      created_at    TIMESTAMPTZ DEFAULT now()
    );

    CREATE INDEX idx_users_email ON users(email);
  `);
};

exports.down = async (db) => {
  await db.runSql(`DROP TABLE IF EXISTS users;`);
};
