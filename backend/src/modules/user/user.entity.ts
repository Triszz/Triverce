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
    // Seller storefront fields — nullable on the entity for all roles,
    // populated only for role = 'seller'.
    public readonly storeName?: string | null,
    public readonly description?: string | null,
    public readonly logoUrl?: string | null,
    public readonly supportEmail?: string | null,
    public readonly phone?: string | null,
    public readonly address?: string | null,
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
      row.storeName,
      row.description,
      row.logoUrl,
      row.supportEmail,
      row.phone,
      row.address,
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

  /**
   * Seller storefront profile shape — exposes only the fields
   * that make sense on the public-facing store page.
   */
  toStoreProfile() {
    return {
      storeName: this.storeName ?? "",
      description: this.description ?? "",
      logoUrl: this.logoUrl ?? "",
      supportEmail: this.supportEmail ?? "",
      phone: this.phone ?? "",
      address: this.address ?? "",
    };
  }
}
