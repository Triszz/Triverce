import { UserRow } from "../../infrastructure/database/db.schema";
export class UserEntity {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly passwordHash: string,
    public readonly fullName: string,
    public readonly role: "customer" | "admin" | "seller",
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
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
      row.full_name,
      row.role,
      row.is_active,
      new Date(row.created_at),
      new Date(row.updated_at),
    );
  }

  toPublic() {
    return {
      id: this.id,
      email: this.email,
      fullName: this.fullName,
      role: this.role,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
