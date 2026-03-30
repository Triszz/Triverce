import { UserRow } from "../../infrastructure/database/db.schema";
export class UserEntity {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly passwordHash: string,
    public readonly role: "customer" | "admin" | "seller",
    public readonly createdAt: Date,
  ) {}

  // Business rules
  isAdmin(): boolean {
    return this.role === "admin";
  }

  isSeller(): boolean {
    return this.role === "seller";
  }

  static fromDatabase(row: UserRow): UserEntity {
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
      id: this.id,
      email: this.email,
      role: this.role,
      createdAt: this.createdAt,
    };
  }
}
