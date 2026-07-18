/**
 * Types mirroring the GET/PUT /api/seller/profile response.
 */

export interface StoreProfile {
  storeName: string;
  description: string;
  logoUrl: string;
  supportEmail: string;
  phone: string;
  address: string;
}

export interface SellerProfileApiResponse {
  success: boolean;
  data: StoreProfile;
}
