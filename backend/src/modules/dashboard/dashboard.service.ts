import { DashboardRepository } from "./dashboard.repository";
import type {
  DashboardMetrics,
  RecentOrderRow,
  RevenueChartRow,
} from "./dashboard.repository";

/** Public shape of the dashboard response. */
export interface DashboardDto {
  totalSales: number;
  activeOrders: number;
  listedProducts: number;
  totalCustomers: number;
  recentOrders: RecentOrderRow[];
  revenueChart: RevenueChartRow[];
}

export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  /**
   * Aggregated seller dashboard metrics + revenue-over-time chart.
   *
   * Three queries run in parallel (`Promise.all` inside the repository) so
   * the endpoint's p99 latency is driven by the slowest individual query
   * rather than the sum of all four.
   */
  async getDashboard(sellerId: string): Promise<DashboardDto> {
    const [metrics, recentOrders, revenueChart] = await Promise.all([
      this.dashboardRepository.getMetrics(sellerId),
      this.dashboardRepository.getRecentOrders(sellerId),
      this.dashboardRepository.getDailyRevenue(sellerId),
    ]);

    return {
      totalSales: metrics.totalSales,
      activeOrders: metrics.activeOrders,
      listedProducts: metrics.listedProducts,
      totalCustomers: metrics.totalCustomers,
      recentOrders,
      revenueChart,
    };
  }
}
