import { useQuery } from '@tanstack/react-query';
import { storeService } from '@/services/storeService';

/**
 * Fetch a seller's public storefront profile by seller ID.
 * Used on `/store/:sellerId` to show the store header + product grid.
 */
export function useStoreProfile(sellerId: string) {
  return useQuery({
    queryKey: ['store', sellerId],
    queryFn: () => storeService.getStoreById(sellerId),
    enabled: !!sellerId,
    staleTime: 60_000,
  });
}
