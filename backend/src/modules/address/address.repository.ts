import type { PrismaClient } from "@prisma/client";

export interface UserAddressDto {
  id: string;
  userId: string;
  recipientName: string;
  phone: string;
  address: string;
  isDefault: boolean;
  createdAt: Date;
}

export class UserAddressRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Fetch all addresses for a user, ordered newest first.
   */
  async findByUserId(userId: string): Promise<UserAddressDto[]> {
    const rows = await this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      recipientName: r.recipientName,
      phone: r.phone,
      address: r.address,
      isDefault: r.isDefault,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Create a new address. If `isDefault` is true, all other addresses for
   * the user are cleared of the default flag first so there is exactly one
   * default at any time.
   */
  async create(
    input: {
      userId: string;
      recipientName: string;
      phone: string;
      address: string;
      isDefault: boolean;
    },
    trx?: import("@prisma/client").Prisma.TransactionClient,
  ): Promise<UserAddressDto> {
    const client = trx ?? this.prisma;

    if (input.isDefault) {
      await client.userAddress.updateMany({
        where: { userId: input.userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const row = await client.userAddress.create({
      data: {
        userId: input.userId,
        recipientName: input.recipientName,
        phone: input.phone,
        address: input.address,
        isDefault: input.isDefault,
      },
    });

    return {
      id: row.id,
      userId: row.userId,
      recipientName: row.recipientName,
      phone: row.phone,
      address: row.address,
      isDefault: row.isDefault,
      createdAt: row.createdAt,
    };
  }

  /**
   * Check whether an address with the same recipientName + phone + address
   * already exists for this user. Used by the checkout auto-save logic to
   * avoid duplicate entries.
   */
  async existsForUser(
    userId: string,
    recipientName: string,
    phone: string,
    address: string,
  ): Promise<boolean> {
    const row = await this.prisma.userAddress.findFirst({
      where: {
        userId,
        recipientName: { equals: recipientName },
        phone: { equals: phone },
        address: { equals: address },
      },
      select: { id: true },
    });
    return row !== null;
  }
}
