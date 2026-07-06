import { PrismaClient } from "@prisma/client";
import type { User } from "@prisma/client";

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

  /**
   * Adapt a Prisma `User` row (camelCase, Decimal timestamps, etc.)
   * to the public-facing entity shape (snake_case → camelCase,
   * Decimal columns → number). Centralized here so repositories
   * stay clean.
   */
  static fromDatabase(row: User): UserEntity {
    return new UserEntity(
      row.id,
      row.email,
      row.passwordHash,
      row.fullName,
      row.role,
      row.isActive,
      row.createdAt,
      row.updatedAt,
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
