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

  /**
   * Update seller storefront profile fields. Exposed as a separate
   * method so the service layer can be explicit about intent — this
   * endpoint is specifically for the store settings page and should
   * not be used for arbitrary field mutations.
   */
  async updateStoreProfile(
    id: string,
    data: {
      storeName?: string | null;
      description?: string | null;
      logoUrl?: string | null;
      supportEmail?: string | null;
      phone?: string | null;
      address?: string | null;
    },
  ): Promise<UserEntity | null> {
    const row = await this.prisma.user.update({
      where: { id },
      data: {
        storeName: data.storeName ?? null,
        description: data.description ?? null,
        logoUrl: data.logoUrl ?? null,
        supportEmail: data.supportEmail ?? null,
        phone: data.phone ?? null,
        address: data.address ?? null,
      },
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

  /**
   * Returns a public store profile for a seller: basic info + active product count.
   * Returns null if the user doesn't exist, is deleted, or isn't a seller.
   */
  async findPublicStoreProfile(
    sellerId: string,
  ): Promise<{
    id: string;
    storeName: string | null;
    logoUrl: string | null;
    description: string | null;
    supportEmail: string | null;
    phone: string | null;
    address: string | null;
    createdAt: Date;
    productCount: number;
  } | null> {
    const [user, productCount] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: sellerId, deletedAt: null, role: 'seller' },
        select: {
          id: true,
          storeName: true,
          logoUrl: true,
          description: true,
          supportEmail: true,
          phone: true,
          address: true,
          createdAt: true,
        },
      }),
      this.prisma.product.count({
        where: { sellerId, isActive: true, deletedAt: null },
      }),
    ]);

    if (!user) return null;
    return {
      id: user.id,
      storeName: user.storeName,
      logoUrl: user.logoUrl,
      description: user.description,
      supportEmail: user.supportEmail,
      phone: user.phone,
      address: user.address,
      createdAt: user.createdAt,
      productCount,
    };
  }

  /**
   * List public store profiles for the global / cross-store search.
   *
   * Returns up to `limit` active, non-deleted sellers whose store name
   * case-insensitively contains `search`. Only sellers with at least one
   * active product are returned, so a buyer who searches "Tris" never
   * sees an empty storefront. Result shape mirrors `findPublicStoreProfile`.
   *
   * Sorted by most recently joined first — surfacing fresh sellers gives
   * the marketplace a more "alive" feel when the query matches a lot of
   * stores.
   */
  async findPublicStores(params: {
    search: string;
    limit?: number;
  }): Promise<
    Array<{
      id: string;
      storeName: string | null;
      logoUrl: string | null;
      description: string | null;
      supportEmail: string | null;
      phone: string | null;
      address: string | null;
      createdAt: Date;
      productCount: number;
    }>
  > {
    const limit = Math.min(Math.max(params.limit ?? 10, 1), 50);
    const trimmed = params.search.trim();
    if (!trimmed) return [];

    const users = await this.prisma.user.findMany({
      where: {
        role: "seller",
        isActive: true,
        deletedAt: null,
        // Case-insensitive substring match on the store name. Mirrors
        // the same pattern used by ProductRepository for product names.
        // The Prisma `not: null` constraint is implicit because `contains`
        // on a nullable column matches only non-null values.
        storeName: { contains: trimmed, mode: "insensitive" },
        // Only surface stores that have at least one active, non-deleted
        // product — keeps the results meaningful for buyers.
        products: { some: { isActive: true, deletedAt: null } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        storeName: true,
        logoUrl: true,
        description: true,
        supportEmail: true,
        phone: true,
        address: true,
        createdAt: true,
        _count: {
          select: {
            products: { where: { isActive: true, deletedAt: null } },
          },
        },
      },
    });

    return users.map((u) => ({
      id: u.id,
      storeName: u.storeName,
      logoUrl: u.logoUrl,
      description: u.description,
      supportEmail: u.supportEmail,
      phone: u.phone,
      address: u.address,
      createdAt: u.createdAt,
      productCount: u._count.products,
    }));
  }
}
