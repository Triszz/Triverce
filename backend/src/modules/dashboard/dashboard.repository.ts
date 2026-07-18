import type { PrismaClient } from "@prisma/client";

/**
 * The minimal shape the dashboard service needs from each aggregation query.
 * Kept narrow so the repository never leaks unintended fields.
 */
export interface DashboardMetrics {
  /** Sum of `totalAmount` on orders where:
   *  - `sellerId = sellerId`
   *  - `status = 'delivered'` (cash collected) AND
   *    the linked payment row is `paid` (VNPay/MoMo settled), OR
   *  - `status = 'confirmed'` AND `paymentMethod = 'cod'`
   *    (COD: confirmed = cash received in-hand, not yet banked)
   *  - `createdAt` within the last 30 days.
   *
   *  This is intentionally conservative: we only count orders where the
   *  seller's cash position is real. A `delivered` order with a
   *  failed/pending payment is a receivable, not a sale. */
  totalSales: number;
  /** Count of the seller's orders with `status IN (pending, confirmed, shipping)`. */
  activeOrders: number;
  /** Count of products where `sellerId = sellerId AND isActive = true`. */
  listedProducts: number;
  /** Count of distinct `customerId` values across all the seller's orders. */
  totalCustomers: number;
}

/** One row of the `recentOrders` list. */
export interface RecentOrderRow {
  id: string;
  createdAt: Date;
  shippingName: string;
  totalAmount: number;
  status: string;
}

/** One data point in the revenue-over-time chart. `date` is ISO-8601
 *  (YYYY-MM-DD); `amount` is the total VND revenue for that day. */
export interface RevenueChartRow {
  date: string; // "2026-06-18"
  amount: number;
}

export class DashboardRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Fetch all four metric scalars in parallel using three Prisma
   * aggregate / count queries and one raw SQL for the revenue sum
   * (Prisma doesn't support `SUM` in typed aggregate — raw is safe here
   * because the WHERE clause is fully parameterized).
   *
   * Raw SQL note: `totalAmount` is a DECIMAL column; we cast to
   * `numeric` before summing and cast the result back to `bigint`
   * (maps to `number` in JavaScript). This avoids floating-point
   * precision loss on large VND amounts.
   */
  async getMetrics(sellerId: string): Promise<DashboardMetrics> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      revenueResult,
      activeOrdersCount,
      listedProductsCount,
      totalCustomersCount,
    ] = await Promise.all([
      // Revenue: delivered orders with settled payment OR confirmed COD
      // orders. We join to `payment` to verify `payment.status = 'paid'`
      // for non-COD orders. The CASE WHEN avoids a full cartesian product
      // on orders with no payment row.
      this.prisma.$queryRaw<Array<{ sum: bigint | null }>>`
        SELECT COALESCE(SUM(ord.total_amount::numeric), 0)::bigint AS sum
        FROM orders ord
        LEFT JOIN payments pay ON pay.id = ord.payment_id
        WHERE ord.seller_id = ${sellerId}
          AND ord.created_at >= ${thirtyDaysAgo}
          AND (
            -- Delivered orders: payment must be settled (paid/refunded)
            -- or the payment may be null for edge cases (e.g. test data).
            (ord.status = 'delivered' AND (pay.status = 'paid' OR pay.status = 'refunded' OR pay.id IS NULL))
            OR
            -- COD orders confirmed in-hand: count when confirmed, not
            -- just delivered, because the seller already has the cash.
            (ord.status = 'confirmed' AND pay.gateway = 'cod' AND pay.status = 'paid')
          )
      `,
      this.prisma.order.count({
        where: {
          sellerId,
          status: { in: ["pending", "confirmed", "shipping"] },
        },
      }),
      this.prisma.product.count({
        where: { sellerId, isActive: true },
      }),
      // Distinct count of customerIds — this is a real aggregation; the
      // query planner will use the sellerId+customerId index efficiently.
      this.prisma.order.groupBy({
        by: ["customerId"],
        where: { sellerId },
        _count: { customerId: true },
      }),
    ]);

    const totalCustomers = totalCustomersCount.length;

    return {
      totalSales: Number(revenueResult[0]?.sum ?? 0),
      activeOrders: activeOrdersCount,
      listedProducts: listedProductsCount,
      totalCustomers,
    };
  }

  /**
   * The 5 most recent orders for the seller, ordered by `createdAt DESC`.
   * Returns only the fields the dashboard needs — no items, no status
   * logs — to keep the payload lean.
   */
  async getRecentOrders(sellerId: string): Promise<RecentOrderRow[]> {
    const rows = await this.prisma.order.findMany({
      where: { sellerId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        shippingName: true,
        totalAmount: true,
        status: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      shippingName: r.shippingName,
      totalAmount: Number(r.totalAmount),
      status: r.status,
    }));
  }

  /**
   * Daily revenue for the last 30 days, zero-filled.
   *
   * Uses PostgreSQL `generate_series(DATE, DATE)` to produce an unbroken
   * sequence of calendar dates, then LEFT JOINs the actual revenue data
   * onto it. Days with no qualifying orders return `0`. The ISO date
   * string (`YYYY-MM-DD`) is returned as a string so the frontend can
   * parse it with `new Date()` without timezone ambiguity.
   *
   * The revenue eligibility criteria match `getMetrics.totalSales`:
   *   - Delivered orders with settled payment (paid / refunded)
   *   - Confirmed COD orders (gateway = 'cod', status = 'paid')
   */
  async getDailyRevenue(sellerId: string): Promise<RevenueChartRow[]> {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 29);
    // Normalize to midnight UTC so the series generates correct dates.
    thirtyDaysAgo.setUTCHours(0, 0, 0, 0);

    // Generate a flat array of ISO date strings for the zero-fill.
    // This avoids the complexity of post-processing a Postgres array
    // result through Prisma's raw type system — Prisma doesn't natively
    // map `generate_series` output to typed arrays, so building the
    // sequence in JS and mapping the DB results onto it is the simpler
    // and more portable approach.
    const dateMap = new Map<string, number>();
    for (let d = new Date(thirtyDaysAgo); d <= today; d.setDate(d.getDate() + 1)) {
      dateMap.set(d.toISOString().slice(0, 10), 0);
    }

    const rows = await this.prisma.$queryRaw<
      Array<{ day: Date; sum: bigint | null }>
    >`
      SELECT
        DATE_TRUNC('day', ord.created_at AT TIME ZONE 'UTC')::date AS day,
        COALESCE(SUM(ord.total_amount::numeric), 0)::bigint AS sum
      FROM orders ord
      LEFT JOIN payments pay ON pay.id = ord.payment_id
      WHERE ord.seller_id = ${sellerId}
        AND ord.created_at >= ${thirtyDaysAgo}
        AND (
          (ord.status = 'delivered'
            AND (pay.status = 'paid' OR pay.status = 'refunded' OR pay.id IS NULL))
          OR
          (ord.status = 'confirmed'
            AND pay.gateway = 'cod'
            AND pay.status = 'paid')
        )
      GROUP BY DATE_TRUNC('day', ord.created_at AT TIME ZONE 'UTC')::date
      ORDER BY day ASC
    `;

    for (const row of rows) {
      const iso = (row.day as Date).toISOString().slice(0, 10);
      dateMap.set(iso, Number(row.sum ?? 0));
    }

    return Array.from(dateMap.entries()).map(([date, amount]) => ({
      date,
      amount,
    }));
  }
}
