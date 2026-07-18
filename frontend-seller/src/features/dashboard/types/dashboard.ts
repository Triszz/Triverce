/**
 * Types mirroring the `DashboardDto` shape returned by
 * `GET /api/seller/dashboard`.
 */

import type { OrderStatus } from "@/types/order";

export interface RecentOrderRow {
  id: string;
  createdAt: string;
  shippingName: string;
  totalAmount: number;
  status: OrderStatus;
}

export interface DashboardMetrics {
  totalSales: number;
  activeOrders: number;
  listedProducts: number;
  totalCustomers: number;
}

/** One data point in the revenue-over-time chart. */
export interface RevenueChartRow {
  date: string; // ISO-8601 "YYYY-MM-DD"
  amount: number; // VND
}

export interface DashboardDto extends DashboardMetrics {
  recentOrders: RecentOrderRow[];
  revenueChart: RevenueChartRow[];
}

export interface DashboardApiResponse {
  success: boolean;
  data: DashboardDto;
}
