/**
 * Domain types for the buyer-side address book feature.
 *
 * Mirrors the wire shape returned by:
 *   GET    /api/user/addresses
 *   POST   /api/user/addresses
 * (See backend/src/modules/address/.)
 */

/** One saved address. */
export interface SavedAddress {
  id: string;
  recipientName: string;
  phone: string;
  address: string;
  isDefault: boolean;
}

/** API response for a single address. */
export interface AddressApiResponse {
  success: boolean;
  data: SavedAddress;
}

/** API response for a list of addresses. */
export interface AddressListApiResponse {
  success: boolean;
  data: SavedAddress[];
}

/** Payload for creating a new saved address. */
export interface CreateAddressPayload {
  recipientName: string;
  phone: string;
  address: string;
  isDefault?: boolean;
}
