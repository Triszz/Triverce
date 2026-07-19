import { Request, Response, NextFunction } from "express";
import { NotificationService } from "./notification.service";
import { BadRequestError, UnauthorizedError } from "../../core/errors/AppError";

/**
 * Controller for the dashboard notification endpoints.
 *
 * All routes require an authenticated seller (or admin) — the
 * `authenticate` middleware is mounted on the router. `sellerId` is
 * always taken from `req.user.userId` so a forged path param can't
 * cross tenant boundaries.
 */
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  /**
   * GET /api/notifications
   *
   * Returns the most-recent notifications for the authenticated
   * seller along with the unread count (for the bell badge).
   *
   * Query: `?limit=N` (default 20, max 100) — caps the payload so a
   * seller with thousands of historical notifications can't bloat
   * the dropdown's first paint.
   */
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new UnauthorizedError("Authentication required");

      const rawLimit = Number(req.query.limit ?? 20);
      const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 20, 1), 100);

      const data = await this.notificationService.listForSeller(req.user.userId, limit);

      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/notifications/:id/read
   *
   * Marks a single notification as read. Returns 200 with
   * `{ updated: true }` even when the row was already read
   * (idempotent), so the frontend can call this unconditionally
   * without worrying about double-click races.
   */
  markRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new UnauthorizedError("Authentication required");

      const id = req.params.id as string | undefined;
      if (!id) throw new BadRequestError("Notification id is required");

      const updated = await this.notificationService.markRead(req.user.userId, id);

      res.status(200).json({ success: true, data: { updated } });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/notifications/read-all
   *
   * Marks every unread notification as read in a single round-trip.
   * Returns the number of rows touched (useful for a toast like
   * "Marked 3 notifications as read").
   */
  markAllRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new UnauthorizedError("Authentication required");

      const { updated } = await this.notificationService.markAllRead(req.user.userId);

      res.status(200).json({ success: true, data: { updated } });
    } catch (error) {
      next(error);
    }
  };
}
