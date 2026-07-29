import { UserRepository } from "../user/user.repository";
import { NotFoundError } from "../../core/errors/AppError";

export interface StoreProfileDto {
  storeName: string;
  description: string;
  logoUrl: string;
  supportEmail: string;
  phone: string;
  address: string;
}

/** Shape returned by the public store profile endpoint. */
export interface PublicStoreProfile {
  id: string;
  storeName: string | null;
  logoUrl: string | null;
  description: string | null;
  supportEmail: string | null;
  phone: string | null;
  address: string | null;
  joinedAt: Date;
  productCount: number;
}

export class SellerService {
  constructor(private userRepository: UserRepository) {}

  /**
   * Retrieve the authenticated seller's storefront profile.
   *
   * Throws `NotFoundError` if the user doesn't exist (e.g. deleted
   * between token issuance and request). Unlikely but defensively handled.
   */
  async getStoreProfile(userId: string): Promise<StoreProfileDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("Seller account not found");
    }
    return user.toStoreProfile();
  }

  /**
   * Retrieve a seller's public storefront profile by seller ID.
   * Used by buyers visiting `/store/:sellerId`.
   */
  async getPublicStoreProfile(sellerId: string): Promise<PublicStoreProfile> {
    const profile = await this.userRepository.findPublicStoreProfile(sellerId);
    if (!profile) {
      throw new NotFoundError("Store not found");
    }
    return {
      ...profile,
      joinedAt: profile.createdAt,
    };
  }

  /**
   * Update the authenticated seller's storefront profile.
   *
   * All fields are optional — only fields that are defined in `dto`
   * are written; omitted fields are left untouched on the row.
   * The repository sets `null` for fields sent as empty strings,
   * which is the natural output of a reset-from-form pattern.
   */
  async updateStoreProfile(
    userId: string,
    dto: Partial<StoreProfileDto>,
  ): Promise<StoreProfileDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("Seller account not found");
    }

    const updated = await this.userRepository.updateStoreProfile(userId, {
      storeName: dto.storeName,
      description: dto.description,
      logoUrl: dto.logoUrl,
      supportEmail: dto.supportEmail,
      phone: dto.phone,
      address: dto.address,
    });

    if (!updated) {
      throw new NotFoundError("Seller account not found");
    }

    return updated.toStoreProfile();
  }
}
