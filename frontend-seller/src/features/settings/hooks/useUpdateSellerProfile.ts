import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/apiClient";
import type { StoreProfile, SellerProfileApiResponse } from "../types/seller-profile";
import { useAuthStore } from "@/stores/useAuthStore";

const QUERY_KEY = ["seller-profile"];

export function useUpdateSellerProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: Partial<StoreProfile>): Promise<SellerProfileApiResponse> => {
      const res = await apiClient.put<SellerProfileApiResponse>(
        "/seller/profile",
        dto,
      );
      return res.data;
    },

    onSuccess: (response) => {
      // Write the fresh profile directly into the cache so the page
      // re-renders without a network round-trip.
      queryClient.setQueryData<SellerProfileApiResponse>(
        QUERY_KEY,
        response,
      );
    },

    onSettled: () => {
      // Invalidate on settle (success or error) so the next full page
      // load is guaranteed to have fresh data from the server.
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/**
 * Upload a store logo image for the current seller.
 *
 * The Authorization header is set explicitly (not relying on the apiClient
 * interceptor alone) to guarantee the JWT reaches the backend on every upload.
 * axios still handles the multipart boundary automatically — only the token
 * is manually injected.
 */
export async function uploadLogo(file: File): Promise<string> {
  const state = useAuthStore.getState();
  const userId = state.user?.id;
  if (!userId) throw new Error("Client error: could not find user ID in local state");

  const formData = new FormData();
  formData.append("logo", file);

  const res = await apiClient.post(`/upload/logos/${userId}`, formData, {
    // Delete the global 'Content-Type: application/json' so the browser
    // can auto-set the correct multipart/form-data header with boundary.
    headers: {
      Authorization: `Bearer ${state.token}`,
      "Content-Type": undefined,
    },
  });

  return (res.data as { success: boolean; data: { url: string } }).data.url;
}
