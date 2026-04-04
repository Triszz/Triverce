"use strict";

exports.up = async (db) => {
  await db.runSql(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
  `);

  await db.runSql(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
  `);
};

exports.down = async (db) => {
  await db.runSql(`ALTER TABLE users DROP COLUMN IF EXISTS deleted_at;`);
  await db.runSql(`ALTER TABLE products DROP COLUMN IF EXISTS deleted_at;`);
};
