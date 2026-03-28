"use strict";

exports.up = async (db) => {
  await db.runSql(`
    CREATE TABLE IF NOT EXISTS variant_attribute_values (
      variant_id   UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
      attribute_id UUID NOT NULL REFERENCES product_attributes(id) ON DELETE RESTRICT,
      value        VARCHAR(100) NOT NULL,
      created_at   TIMESTAMPTZ DEFAULT now(),

      PRIMARY KEY (variant_id, attribute_id)
    );

    -- Query tất cả variants có cùng 1 attribute (VD: tìm tất cả variant màu Đỏ)
    CREATE INDEX idx_vav_attribute_id ON variant_attribute_values(attribute_id);
  `);
};

exports.down = async (db) => {
  await db.runSql(`DROP TABLE IF EXISTS variant_attribute_values;`);
};
