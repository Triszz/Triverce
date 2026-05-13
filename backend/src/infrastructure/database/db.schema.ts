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

export interface CartsTable {
  id: Generated<string>;
  user_id: string;
  status: Generated<"active" | "checked_out" | "abandoned">;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface CartItemsTable {
  id: Generated<string>;
  cart_id: string;
  variant_id: string;
  quantity: number;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface OrdersTable {
  id: Generated<string>;
  customer_id: string;
  seller_id: string;
  status: Generated<
    "pending" | "confirmed" | "shipping" | "delivered" | "cancelled" | "failed"
  >;
  total_amount: ColumnType<number, string | number, string | number>;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  note: string | null;
  cancelled_reason: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  payment_id: string | null;
}

export interface OrderItemsTable {
  id: Generated<string>;
  order_id: string;
  variant_id: string;
  quantity: number;
  unit_price: ColumnType<number, string | number, string | number>;
  product_name: string;
  variant_sku: string;
  created_at: Generated<Date>;
}

export interface OrderStatusLogsTable {
  id: Generated<string>;
  order_id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  note: string | null;
  created_at: Generated<Date>;
}

export interface PaymentsTable {
  id: Generated<string>;
  customer_id: string;
  amount: ColumnType<number, string | number, string | number>;
  currency: Generated<string>;
  status: Generated<
    "pending" | "processing" | "paid" | "failed" | "cancelled" | "refunded"
  >;
  gateway: "momo" | "stripe" | "vnpay" | "cod";
  gateway_ref: string | null;
  gateway_data: unknown | null;
  idempotency_key: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface WebhookEventsTable {
  id: string;
  gateway: string;
  event_type: string;
  payload: unknown;
  processed_at: Generated<Date>;
}
export interface DatabaseSchema {
  // User table
  users: UsersTable;
  // Category table
  categories: CategoriesTable;
  // Product table
  products: ProductsTable;
  product_attributes: ProductAttributesTable;
  product_variants: ProductVariantsTable;
  variant_attribute_values: VariantAttributeValuesTable;
  // Inventory table
  inventory: InventoryTable;
  // Cart table
  carts: CartsTable;
  cart_items: CartItemsTable;
  // Order table
  orders: OrdersTable;
  order_items: OrderItemsTable;
  order_status_logs: OrderStatusLogsTable;
  // Payment table
  payments: PaymentsTable;
  webhook_events: WebhookEventsTable;
}

// User table
export type UserRow = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;

// Category table
export type CategoryRow = Selectable<CategoriesTable>;
export type NewCategory = Insertable<CategoriesTable>;
export type CategoryUpdate = Updateable<CategoriesTable>;

// Product table
export type ProductRow = Selectable<ProductsTable>;
export type NewProduct = Insertable<ProductsTable>;
export type ProductUpdate = Updateable<ProductsTable>;

// Product attribute table
export type ProductAttributeRow = Selectable<ProductAttributesTable>;

// Product variant table
export type ProductVariantRow = Selectable<ProductVariantsTable>;
export type NewProductVariant = Insertable<ProductVariantsTable>;
export type ProductVariantUpdate = Updateable<ProductVariantsTable>;
export type ProductVariantWithStock = ProductVariantRow & {
  available?: number | null;
};

// Variant attribute table
export type VariantAttributeValueRow = Selectable<VariantAttributeValuesTable>;
export type NewVariantAttributeValue = Insertable<VariantAttributeValuesTable>;

// Inventory table
export type InventoryRow = Selectable<InventoryTable>;
export type NewInventory = Insertable<InventoryTable>;
export type InventoryUpdate = Updateable<InventoryTable>;

// Cart table
export type CartRow = Selectable<CartsTable>;
export type NewCart = Insertable<CartsTable>;
export type CartUpdate = Updateable<CartsTable>;
export type CartItemWithDetails = CartItemRow & {
  variant_sku: string | undefined;
  variant_price: number | undefined;
  variant_image_url: string | null | undefined;
  product_name: string | undefined;
  product_slug: string | undefined;
};

// Cart item table
export type CartItemRow = Selectable<CartItemsTable>;
export type NewCartItem = Insertable<CartItemsTable>;
export type CartItemUpdate = Updateable<CartItemsTable>;

// Order table
export type OrderRow = Selectable<OrdersTable>;
export type NewOrder = Insertable<OrdersTable>;
export type OrderUpdate = Updateable<OrdersTable>;

// Order item table
export type OrderItemRow = Selectable<OrderItemsTable>;
export type NewOrderItem = Insertable<OrderItemsTable>;

// Order status log table
export type OrderStatusLogRow = Selectable<OrderStatusLogsTable>;
export type NewOrderStatusLog = Insertable<OrderStatusLogsTable>;

// Payment table
export type PaymentRow = Selectable<PaymentsTable>;
export type NewPayment = Insertable<PaymentsTable>;
export type PaymentUpdate = Updateable<PaymentsTable>;

// Webhook events table
export type WebhookEventRow = Selectable<WebhookEventsTable>;
export type NewWebhookEvent = Insertable<WebhookEventsTable>;
