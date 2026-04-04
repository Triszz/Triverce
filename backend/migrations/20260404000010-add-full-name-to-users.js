"use strict";

exports.up = async (db) => {
  await db.runSql(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS full_name VARCHAR(255) NOT NULL DEFAULT '';
  `);
};

exports.down = async (db) => {
  await db.runSql(`
    ALTER TABLE users DROP COLUMN IF EXISTS full_name;
  `);
};
