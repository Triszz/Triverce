import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/apiClient";
import type { SellerProfileApiResponse } from "../types/seller-profile";

const QUERY_KEY = ["seller-profile"];

export function useSellerProfile() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<SellerProfileApiResponse> => {
      const res = await apiClient.get<SellerProfileApiResponse>(
        "/seller/profile",
      );
      return res.data;
    },
    staleTime: Infinity, // Profile changes only on explicit save.
    retry: 2,
  });
}
