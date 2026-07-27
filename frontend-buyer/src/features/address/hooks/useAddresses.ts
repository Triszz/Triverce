import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addressService } from '../services/addressService';
import type { CreateAddressPayload } from '../types/address';

/** Query key namespace for address book queries. */
export const ADDRESS_QUERY_KEY = ['addresses'] as const;

/**
 * useAddresses — fetches the buyer's saved address list.
 *
 * Returns `undefined` while loading so callers can render skeletons.
 * `enabled` is overridable so the hook can be disabled when the
 * checkout page renders without a logged-in user (e.g. redirect guard).
 */
export function useAddresses(enabled = true) {
  return useQuery({
    queryKey: ADDRESS_QUERY_KEY,
    queryFn: () => addressService.listAddresses(),
    enabled,
    staleTime: 30 * 1000,
    retry: 1,
  });
}

/**
 * useCreateAddress — mutation for creating a new saved address.
 *
 * On success, invalidates the address list cache so the new address
 * appears immediately without a full refetch.
 */
export function useCreateAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateAddressPayload) =>
      addressService.createAddress(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADDRESS_QUERY_KEY });
    },
  });
}
