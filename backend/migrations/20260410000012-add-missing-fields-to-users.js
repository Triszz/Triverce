"use strict";

exports.up = async (db) => {
  await db.runSql(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_active  BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
  `);
};

exports.down = async (db) => {
  await db.runSql(`
    ALTER TABLE users
    DROP COLUMN IF EXISTS is_active,
    DROP COLUMN IF EXISTS updated_at;
  `);
};
