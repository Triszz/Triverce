/**
 * User address service contract.
 *
 * `OrderService` depends on this interface so it can auto-save new
 * shipping addresses at checkout without creating a circular DI
 * dependency between the order and address modules.
 */
export interface IUserAddressService {
  /**
   * Persist a new address for the user, but only if an identical one
   * doesn't already exist. Returns the created address or `null` if
   * it was a duplicate (already exists).
   *
   * Accepts an optional Prisma `TransactionClient` so the caller can
   * include the save in its own transaction.
   */
  createIfNotDuplicate(
    userId: string,
    recipientName: string,
    phone: string,
    address: string,
    trx?: import("@prisma/client").Prisma.TransactionClient,
  ): Promise<{ id: string } | null>;
}
