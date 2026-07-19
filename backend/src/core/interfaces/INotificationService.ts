/**
 * Notification service contract.
 *
 * The order / payment modules depend on this interface (not the concrete
 * service) so they can publish notification events without creating a
 * circular DI dependency between themselves and the notification module.
 *
 * Methods intentionally accept a `Prisma.TransactionClient` for the
 * "create" path so notification creation can be folded into the same
 * transaction as the order/payment mutation that triggered it — that
 * way a failed order insert can't leave a ghost notification, and a
 * cancelled order can't land before its cancellation log row.
 */
export interface NotificationCreateInput {
  sellerId: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string;
}

export interface INotificationService {
  /**
   * Persist a single notification for the given seller.
   *
   * Accepts an optional Prisma `TransactionClient` so the caller can
   * include the notification in its own transaction. When omitted, the
   * service uses the shared `prisma` client.
   */
  create(
    input: NotificationCreateInput,
    trx?: import("@prisma/client").Prisma.TransactionClient,
  ): Promise<void>;
}
