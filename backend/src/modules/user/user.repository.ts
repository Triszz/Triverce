import { Kysely } from "kysely";
import { DatabaseSchema } from "../../infrastructure/database/db.schema";
import { UserEntity } from "./user.entity";

export class UserRepository {
  constructor(private db: Kysely<DatabaseSchema>) {}

  async findById(id: string): Promise<UserEntity | null> {
    const row = await this.db
      .selectFrom("users")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? UserEntity.fromDatabase(row) : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const row = await this.db
      .selectFrom("users")
      .selectAll()
      .where("email", "=", email)
      .executeTakeFirst();

    return row ? UserEntity.fromDatabase(row) : null;
  }

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

  async emailExists(email: string): Promise<boolean> {
    const row = await this.db
      .selectFrom("users")
      .select("id")
      .where("email", "=", email)
      .executeTakeFirst();

    return !!row;
  }
}
