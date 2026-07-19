import { NotificationRepository, type NotificationDto } from "./notification.repository";
import type { INotificationService, NotificationCreateInput } from "../../core/interfaces/INotificationService";

/**
 * Public payload returned by the list endpoint, with the lightweight
 * `unreadCount` sibling so the frontend can render the badge without
 * a second round-trip.
 */
export interface NotificationsPageDto {
  notifications: NotificationDto[];
  unreadCount: number;
}

/**
 * NotificationService — read API for the dashboard bell dropdown.
 *
 * Implements `INotificationService` (the contract used by the order /
 * payment modules to publish new notifications) so the same class
 * powers both the inbound publish path and the outbound query path.
 * No separate "NotificationCreator" class is needed: the contract
 * exposes only the publish methods, and the read API is the
 * service's own public surface.
 */
export class NotificationService implements INotificationService {
  constructor(private readonly notificationRepository: NotificationRepository) {}

  /**
   * Publish a new notification.
   *
   * `sellerId` is supplied by the caller (order module knows the
   * `sellerId` of the order, payment module knows the order's seller,
   * etc.) — the service doesn't infer it.
   */
  async create(
    input: NotificationCreateInput,
    trx?: import("@prisma/client").Prisma.TransactionClient,
  ): Promise<void> {
    await this.notificationRepository.create(input, trx);
  }

  /**
   * List the most recent notifications for a seller + unread count.
   *
   * Both queries run in parallel (`Promise.all`) so the bell's first
   * paint doesn't block on a sequential count-then-list round-trip.
   */
  async listForSeller(
    sellerId: string,
    limit: number = 20,
  ): Promise<NotificationsPageDto> {
    const [notifications, unreadCount] = await Promise.all([
      this.notificationRepository.findRecentBySeller(sellerId, limit),
      this.notificationRepository.countUnread(sellerId),
    ]);
    return { notifications, unreadCount };
  }

  /**
   * Mark a single notification read. Returns `true` if a row was
   * transitioned from unread→read, `false` if the notification
   * didn't exist for this seller or was already read.
   */
  async markRead(sellerId: string, notificationId: string): Promise<boolean> {
    return this.notificationRepository.markRead(sellerId, notificationId);
  }

  /**
   * Mark every unread notification as read.
   */
  async markAllRead(sellerId: string): Promise<{ updated: number }> {
    const updated = await this.notificationRepository.markAllRead(sellerId);
    return { updated };
  }
}
