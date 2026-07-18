import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/apiClient";
import type { DashboardApiResponse } from "../types/dashboard";

const QUERY_KEY = ["dashboard"];

export function useDashboardMetrics() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<DashboardApiResponse> => {
      const res = await apiClient.get<DashboardApiResponse>(
        "/seller/dashboard",
      );
      return res.data;
    },
    staleTime: 30 * 1000, // 30 s — metrics don't need to be real-time.
    retry: 2,
  });
}
