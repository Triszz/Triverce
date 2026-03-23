import { Selectable } from "kysely";
import { UsersTable } from "../../infrastructure/database/db.schema";

export class UserEntity {
  constructor(
    private readonly _id: string,
    private readonly _email: string,
    private readonly _passwordHash: string,
    private readonly _role: "customer" | "admin" | "seller",
    private readonly _createdAt: Date,
  ) {}

  // Getters
  get id(): string {
    return this._id;
  }
  get email(): string {
    return this._email;
  }
  get passwordHash(): string {
    return this._passwordHash;
  }

  get role(): "customer" | "admin" | "seller" {
    return this._role;
  }

  isAdmin(): boolean {
    return this._role === "admin";
  }

  isSeller(): boolean {
    return this._role === "seller";
  }

  static fromDatabase(row: Selectable<UsersTable>): UserEntity {
    return new UserEntity(
      row.id,
      row.email,
      row.password_hash,
      row.role,
      new Date(row.created_at),
    );
  }

  toPublic() {
    return {
      id: this._id,
      email: this._email,
      role: this._role,
      createdAt: this._createdAt,
    };
  }
}
