import { Request, Response, NextFunction } from "express";
import {
  IUploadService,
  UploadResult,
} from "../../core/interfaces/IUploadService";
import { BadRequestError, NotFoundError } from "../../core/errors/AppError";
import { ProductService } from "../product/product.service";

export class UploadController {
  constructor(
    private uploadService: IUploadService,
    private productService: ProductService,
  ) {}

  /**
   * Upload one or more product images and **persist them on the product row**.
   *
   * Form field: `images` (mulipart, multer.array('images', 10)).
   * Returns the freshly stored `images[]` array (already persisted) so
   * the dashboard can reflect the new state without a second round-trip.
   *
   * Why the upload controller owns persistence: `LocalUploadService` is
   * composed as a singleton and stays I/O-only. The product service has
   * the ownership check + transactional semantics we need; we wire the
   * two together here rather than coupling the upload module to the
   * product module.
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

      // Process files first so we have URLs, then append to the row.
      // On failure during persistence we DON'T roll back the uploaded
      // files (the dashboard can retry the persistence via PUT /images);
      // the trade-off here is simpler than a cross-table transaction.
      const uploaded: UploadResult[] = await this.uploadService.uploadProductImages(
        files,
        productId,
      );
      const urls = uploaded.map((u) => u.url);
      const storedImages = await this.productService.appendProductImages(
        productId,
        urls,
        req.user!,
      );

      res.status(201).json({
        success: true,
        data: { images: uploaded, storedImages },
      });
    } catch (error) {
      next(error);
    }
  };

  // Backwards-compat single-file endpoint. Dashboard doesn't use it
  // anymore; the buyer-variant upload still works as-is.
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
      await this.productService.appendProductImages(
        req.params.productId as string,
        [result.url],
        req.user!,
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
