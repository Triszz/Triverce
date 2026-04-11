import {
  Generated,
  Selectable,
  Insertable,
  Updateable,
  ColumnType,
} from "kysely";

export interface UsersTable {
  id: Generated<string>;
  email: string;
  password_hash: string;
  full_name: string;
  role: Generated<"customer" | "admin" | "seller">;
  is_active: Generated<boolean>;
  deleted_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface CategoriesTable {
  id: Generated<string>;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  is_active: Generated<boolean>;
  sort_order: Generated<number>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ProductsTable {
  id: Generated<string>;
  category_id: string | null;
  seller_id: string;
  name: string;
  slug: string;
  description: string | null;
  base_price: ColumnType<number, string | number, string | number>;
  is_active: Generated<boolean>;
  deleted_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ProductAttributesTable {
  id: Generated<string>;
  name: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ProductVariantsTable {
  id: Generated<string>;
  product_id: string;
  sku: string;
  price: ColumnType<number, string | number, string | number>;
  image_url: string | null;
  is_active: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface VariantAttributeValuesTable {
  variant_id: string;
  attribute_id: string;
  value: string;
  created_at: Generated<Date>;
}

export interface InventoryTable {
  id: Generated<string>;
  variant_id: string;
  quantity: Generated<number>;
  reserved: Generated<number>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface CartTable {
  id: Generated<string>;
  user_id: string;
  status: Generated<"active" | "checked_out" | "abandoned">;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface CartItemTable {
  id: Generated<string>;
  cart_id: string;
  variant_id: string;
  quantity: number;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}
export interface DatabaseSchema {
  users: UsersTable;
  categories: CategoriesTable;
  products: ProductsTable;
  product_attributes: ProductAttributesTable;
  product_variants: ProductVariantsTable;
  variant_attribute_values: VariantAttributeValuesTable;
  inventory: InventoryTable;
  carts: CartTable;
  cart_items: CartItemTable;
}

export type UserRow = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;

export type CategoryRow = Selectable<CategoriesTable>;
export type NewCategory = Insertable<CategoriesTable>;
export type CategoryUpdate = Updateable<CategoriesTable>;

export type ProductRow = Selectable<ProductsTable>;
export type NewProduct = Insertable<ProductsTable>;
export type ProductUpdate = Updateable<ProductsTable>;

export type ProductAttributeRow = Selectable<ProductAttributesTable>;

export type ProductVariantRow = Selectable<ProductVariantsTable>;
export type NewProductVariant = Insertable<ProductVariantsTable>;
export type ProductVariantUpdate = Updateable<ProductVariantsTable>;

export type VariantAttributeValueRow = Selectable<VariantAttributeValuesTable>;
export type NewVariantAttributeValue = Insertable<VariantAttributeValuesTable>;

export type InventoryRow = Selectable<InventoryTable>;
export type NewInventory = Insertable<InventoryTable>;
export type InventoryUpdate = Updateable<InventoryTable>;

export type CartRow = Selectable<CartTable>;
export type NewCart = Insertable<CartTable>;
export type CartUpdate = Updateable<CartTable>;
export type CartItemWithDetails = CartItemRow & {
  variant_sku: string | undefined;
  variant_price: number | undefined;
  variant_image_url: string | null | undefined;
  product_name: string | undefined;
  product_slug: string | undefined;
};

export type CartItemRow = Selectable<CartItemTable>;
export type NewCartItem = Insertable<CartItemTable>;
export type CartItemUpdate = Updateable<CartItemTable>;
