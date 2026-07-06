import { PrismaClient, Prisma } from "@prisma/client";
import { UserEntity } from "./user.entity";

/**
 * UserRepository — Prisma-backed.
 *
 * Public API unchanged from the Kysely version:
 *   findById / findByEmail / create / update / setActiveStatus /
 *   delete / emailExists
 * Service layer does not need to be modified.
 *
 * Decimal/number conversion happens inside the entity's fromDatabase().
 */
export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<UserEntity | null> {
    const row = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
        isActive: true,
      },
    });
    return row ? UserEntity.fromDatabase(row) : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const row = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    return row ? UserEntity.fromDatabase(row) : null;
  }

  async create(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    role?: "customer" | "admin" | "seller";
  }): Promise<UserEntity> {
    const row = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        fullName: data.fullName,
        role: data.role ?? "customer",
      },
    });
    return UserEntity.fromDatabase(row);
  }

  async update(
    id: string,
    data: Partial<{
      fullName: string;
      passwordHash: string;
    }>,
  ): Promise<UserEntity | null> {
    const updateData: Prisma.UserUpdateInput = {};
    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.passwordHash !== undefined) updateData.passwordHash = data.passwordHash;

    const row = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });
    return UserEntity.fromDatabase(row);
  }

  async setActiveStatus(
    id: string,
    isActive: boolean,
  ): Promise<UserEntity | null> {
    try {
      const row = await this.prisma.user.update({
        where: { id },
        data: { isActive },
      });
      return UserEntity.fromDatabase(row);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isActive: false,
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  async emailExists(email: string): Promise<boolean> {
    const found = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return !!found;
  }
}
