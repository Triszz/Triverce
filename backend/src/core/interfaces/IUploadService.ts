import "multer";

export interface UploadResult {
  url: string;
  fileName: string;
  originalName: string;
  size: number;
  mimeType: string;
}

/**
 * Upload service contract.
 *
 * The upload service is the I/O layer only — it returns URLs, the
 * product service handles persistence. Keeping the responsibilities
 * split means the upload service stays a singleton, free of
 * product-service scope complications, and we get clear ownership of
 * "files in, URLs out" vs "URLs onto the row".
 */
export interface IUploadService {
  /** Upload multiple images for a product (used by /api/upload/products/:id). */
  uploadProductImages(
    files: Express.Multer.File[],
    productId: string,
  ): Promise<UploadResult[]>;

  /** Legacy single-image call, kept for backwards-compat callers. */
  uploadProductImage(
    file: Express.Multer.File,
    productId: string,
  ): Promise<UploadResult>;

  uploadVariantImage(
    file: Express.Multer.File,
    variantId: string,
  ): Promise<UploadResult>;

  deleteFile(fileName: string): Promise<boolean>;
}
