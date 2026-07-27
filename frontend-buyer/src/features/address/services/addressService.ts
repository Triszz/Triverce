import apiClient from '@/services/apiClient';
import type {
  AddressApiResponse,
  AddressListApiResponse,
  CreateAddressPayload,
  SavedAddress,
} from '../types/address';

/* ──────────────────────────────────────────────────────────────────────────
 * Address service — wraps the `/api/user/addresses` endpoints.
 *
 * All calls require a valid JWT (attached by the apiClient interceptor).
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Fetch all saved addresses for the current user.
 * Ordered newest first, with the default address first in the list.
 */
async function listAddresses(): Promise<SavedAddress[]> {
  const { data } = await apiClient.get<AddressListApiResponse>(
    '/user/addresses',
  );
  return data.data;
}

/**
 * Create a new saved address.
 * The backend automatically clears other defaults if `isDefault` is true.
 */
async function createAddress(
  payload: CreateAddressPayload,
): Promise<SavedAddress> {
  const { data } = await apiClient.post<AddressApiResponse>(
    '/user/addresses',
    payload,
  );
  return data.data;
}

export const addressService = {
  listAddresses,
  createAddress,
};
