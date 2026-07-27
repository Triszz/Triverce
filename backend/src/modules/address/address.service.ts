import { UserAddressRepository, type UserAddressDto } from "./address.repository";
import type { IUserAddressService } from "../../core/interfaces/IUserAddressService";
import type { Prisma } from "@prisma/client";

export interface CreateAddressInput {
  recipientName: string;
  phone: string;
  address: string;
  isDefault?: boolean;
}

export class UserAddressService implements IUserAddressService {
  constructor(private readonly addressRepository: UserAddressRepository) {}

  async listForUser(userId: string): Promise<UserAddressDto[]> {
    return this.addressRepository.findByUserId(userId);
  }

  async createForUser(
    userId: string,
    input: CreateAddressInput,
  ): Promise<UserAddressDto> {
    return this.addressRepository.create({
      userId,
      recipientName: input.recipientName,
      phone: input.phone,
      address: input.address,
      isDefault: input.isDefault ?? false,
    });
  }

  /**
   * Persist a new address inside an existing transaction, but only if an
   * identical address doesn't already exist for the user.
   *
   * Returns the address if it was created, or `null` if it was a duplicate.
   * The `trx` parameter lets `OrderService` fold this into its own
   * `prisma.$transaction` without creating a nested transaction.
   */
  async createIfNotDuplicate(
    userId: string,
    recipientName: string,
    phone: string,
    address: string,
    trx?: Prisma.TransactionClient,
  ): Promise<{ id: string } | null> {
    const exists = await this.addressRepository.existsForUser(
      userId,
      recipientName,
      phone,
      address,
    );
    if (exists) return null;

    const created = await this.addressRepository.create(
      {
        userId,
        recipientName,
        phone,
        address,
        isDefault: false,
      },
      trx,
    );
    return { id: created.id };
  }
}
