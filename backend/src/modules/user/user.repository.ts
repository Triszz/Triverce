import { Kysely } from "kysely";
import { DatabaseSchema } from "../../infrastructure/database/db.schema";
import { UserEntity } from "./user.entity";

export class UserRepository {
  constructor(private db: Kysely<DatabaseSchema>) {}

  // Find user by id
  async findById(id: string): Promise<UserEntity | null> {
    const row = await this.db
      .selectFrom("users")
      .selectAll()
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst();

    return row ? UserEntity.fromDatabase(row) : null;
  }

  // Find user by email
  async findByEmail(email: string): Promise<UserEntity | null> {
    const row = await this.db
      .selectFrom("users")
      .selectAll()
      .where("email", "=", email)
      .where("deleted_at", "is", null)
      .executeTakeFirst();

    return row ? UserEntity.fromDatabase(row) : null;
  }

  // Create user
  async create(data: {
    email: string;
    passwordHash: string;
    role?: "customer" | "admin" | "seller";
  }): Promise<UserEntity> {
    const row = await this.db
      .insertInto("users")
      .values({
        email: data.email,
        password_hash: data.passwordHash,
        role: data.role ?? "customer",
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return UserEntity.fromDatabase(row);
  }

  // Delete user
  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .updateTable("users")
      .set({ deleted_at: new Date() })
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst();

    return Number(result.numUpdatedRows) > 0;
  }

  async emailExists(email: string): Promise<boolean> {
    const row = await this.db
      .selectFrom("users")
      .select("id")
      .where("email", "=", email)
      .executeTakeFirst();

    return !!row;
  }
}
