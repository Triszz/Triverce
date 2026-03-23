import { Generated } from "kysely";

export interface UsersTable {
  id: Generated<string>;
  email: string;
  password_hash: string;
  role: "customer" | "admin" | "seller";
  created_at: Generated<Date>;
}

export interface DatabaseSchema {
  users: UsersTable;
}
