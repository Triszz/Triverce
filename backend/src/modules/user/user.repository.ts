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
      .where("is_active", "=", true)
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
    fullName: string;
    role?: "customer" | "admin" | "seller";
  }): Promise<UserEntity> {
    const row = await this.db
      .insertInto("users")
      .values({
        email: data.email,
        password_hash: data.passwordHash,
        full_name: data.fullName,
        role: data.role ?? "customer",
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return UserEntity.fromDatabase(row);
  }

  // Update user
  async update(
    id: string,
    data: Partial<{
      fullName: string;
      passwordHash: string;
    }>,
  ): Promise<UserEntity | null> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (data.fullName !== undefined) updateData.full_name = data.fullName;
    if (data.passwordHash !== undefined)
      updateData.password_hash = data.passwordHash;

    const row = await this.db
      .updateTable("users")
      .set(updateData)
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .returningAll()
      .executeTakeFirst();

    return row ? UserEntity.fromDatabase(row) : null;
  }

  // Set user active status - admin only
  async setActiveStatus(
    id: string,
    isActive: boolean,
  ): Promise<UserEntity | null> {
    const row = await this.db
      .updateTable("users")
      .set({
        is_active: isActive,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .returningAll()
      .executeTakeFirst();

    return row ? UserEntity.fromDatabase(row) : null;
  }

  // Delete user
  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .updateTable("users")
      .set({ deleted_at: new Date(), is_active: false, updated_at: new Date() })
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
