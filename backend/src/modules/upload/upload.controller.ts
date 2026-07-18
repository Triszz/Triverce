import { Request, Response, NextFunction } from "express";
import { IUploadService } from "../../core/interfaces/IUploadService";
import { BadRequestError, NotFoundError } from "../../core/errors/AppError";

export class UploadController {
  constructor(private uploadService: IUploadService) {}

  /**
   * Upload one or more product images.
   *
   * Form field: `images` (mulipart, multer.array('images', 10)).
   *
   * Returns the freshly stored `UploadResult[]` (one per uploaded file).
   * **Does NOT mutate the Product row.** The dashboard orchestrates the
   * final gallery shape via `PUT /api/products/:id/images`; if this
   * endpoint also auto-appended, a partial failure (e.g. PUT rejected by
   * Zod) would leave the database with ghost rows while the dashboard
   * believed the deletion succeeded. Keeping I/O pure here means the
   * upload endpoint is a single, atomic side-effect: write file → return
   * URL. Whatever doesn't make it into `PUT /api/products/:id/images`
   * is never persisted.
   *
   * Note: the variant image endpoint also follows the same contract —
   * the variant PATCH flow is what attaches the URL to a row.
   */
  uploadProductImages = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      if (files.length === 0) throw new BadRequestError("No files uploaded");

      const productId = req.params.productId as string;
      const uploaded = await this.uploadService.uploadProductImages(
        files,
        productId,
      );

      res.status(201).json({
        success: true,
        data: { images: uploaded },
      });
    } catch (error) {
      next(error);
    }
  };

  // Legacy single-image endpoint. Dashboard no longer calls this — the
  // seller flow is multi-image. Kept for backwards compatibility with
  // any out-of-band scripts. As above, does NOT mutate the product row.
  uploadProductImage = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.file) throw new BadRequestError("No file uploaded");

      const result = await this.uploadService.uploadProductImage(
        req.file,
        req.params.productId as string,
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Upload variant image
  uploadVariantImage = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.file) throw new BadRequestError("No file uploaded");

      const result = await this.uploadService.uploadVariantImage(
        req.file,
        req.params.variantId as string,
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/upload/logos/:sellerId
   *
   * Uploads and stores a seller's store logo. The URL is returned
   * directly — the caller (SellerService) writes it into the
   * `users.logo_url` field. Does NOT auto-update the user row (I/O
   * purity contract — same reason as the product image endpoint).
   *
   * The `:sellerId` param is validated against `req.user.userId` by
   * the `requireRole` guard in the route; the upload service doesn't
   * have access to the auth context.
   */
  uploadLogo = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.file) throw new BadRequestError("No file uploaded");

      const result = await this.uploadService.uploadLogo(
        req.file,
        req.params.sellerId as string,
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Delete file
  deleteFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { folder, filename } = req.params;

      if (!folder || !filename) {
        throw new BadRequestError("Both folder and filename are required");
      }

      if (!["products", "variants"].includes(folder as string)) {
        throw new BadRequestError("Invalid folder");
      }

      const fullFilename = `${folder}/${filename}`;

      const deleted = await this.uploadService.deleteFile(fullFilename);
      if (!deleted) {
        throw new NotFoundError(`File "${fullFilename}" not found`);
      }

      res.status(200).json({
        success: true,
        message: "File deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };
}
