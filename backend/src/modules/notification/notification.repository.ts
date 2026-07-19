import type { PrismaClient } from "@prisma/client";

/**
 * Wire shape returned by the notifications API.
 *
 * Mirrors the `Notification` model exactly. Kept here (not in a
 * dedicated DTO file) because the model is small and the
 * controller's response is a 1:1 projection of the row.
 */
export interface NotificationDto {
  id: string;
  sellerId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  actionUrl: string | null;
  createdAt: Date;
}

export class NotificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Fetch the most-recent N notifications for a seller.
   *
   * Ordered `createdAt DESC` so the bell dropdown always shows the
   * freshest events at the top. Capped at `limit` rows so the
   * payload stays tiny (the dropdown only renders a handful of rows
   * anyway).
   */
  async findRecentBySeller(
    sellerId: string,
    limit: number,
  ): Promise<NotificationDto[]> {
    const rows = await this.prisma.notification.findMany({
      where: { sellerId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      sellerId: r.sellerId,
      type: r.type,
      title: r.title,
      message: r.message,
      isRead: r.isRead,
      actionUrl: r.actionUrl,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Count of unread notifications for the badge.
   *
   * Backed by the composite index `(seller_id, is_read)` so it stays
   * O(log n) regardless of how old the read history gets.
   */
  async countUnread(sellerId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { sellerId, isRead: false },
    });
  }

  /**
   * Mark a single notification as read.
   *
   * Returns `true` if a row was updated, `false` if the id didn't
   * exist (already read counts as updated by `updateMany` — so we
   * check the explicit `id AND isRead = false` shape instead).
   */
  async markRead(sellerId: string, notificationId: string): Promise<boolean> {
    // Scope the update by sellerId so a forged id from another
    // seller's tenant can't be flipped to read by guessing the
    // UUID. (Not a real risk with UUID v4, but cheap defense.)
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, sellerId, isRead: false },
      data: { isRead: true },
    });
    return result.count > 0;
  }

  /**
   * Mark every unread notification for the seller as read.
   * Idempotent — returns the number of rows touched.
   */
  async markAllRead(sellerId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { sellerId, isRead: false },
      data: { isRead: true },
    });
    return result.count;
  }

  /**
   * Create a single notification row.
   *
   * Accepts an optional `TransactionClient` so the caller can fold
   * the notification into its own transaction (see
   * `INotificationService.create`). When `trx` is omitted the shared
   * `prisma` client is used.
   */
  async create(
    input: {
      sellerId: string;
      type: string;
      title: string;
      message: string;
      actionUrl?: string;
    },
    trx?: import("@prisma/client").Prisma.TransactionClient,
  ): Promise<void> {
    const client = trx ?? this.prisma;
    await client.notification.create({
      data: {
        sellerId: input.sellerId,
        type: input.type,
        title: input.title,
        message: input.message,
        actionUrl: input.actionUrl ?? null,
      },
    });
  }
}
