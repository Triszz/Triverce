import "multer";

export interface UploadResult {
  url: string;
  fileName: string;
  originalName: string;
  size: number;
  mimeType: string;
}
export interface IUploadService {
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
