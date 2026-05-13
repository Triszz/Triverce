"use strict";

exports.up = async (db) => {
  await db.runSql(`
    ALTER TABLE orders 
      DROP CONSTRAINT IF EXISTS orders_status_check,
      ADD CONSTRAINT orders_status_check 
      CHECK (status IN ('pending', 'confirmed', 'shipping', 'delivered', 'cancelled', 'failed'));
  `);
};

exports.down = async (db) => {
  await db.runSql(`
    ALTER TABLE orders 
      DROP CONSTRAINT IF EXISTS orders_status_check,
      ADD CONSTRAINT orders_status_check 
      CHECK (status IN ('pending', 'confirmed', 'shipping', 'delivered', 'cancelled'));
  `);
};