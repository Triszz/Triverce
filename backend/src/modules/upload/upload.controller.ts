import { Request, Response, NextFunction } from "express";
import { IUploadService } from "../../core/interfaces/IUploadService";
import { BadRequestError, NotFoundError } from "../../core/errors/AppError";

export class UploadController {
  constructor(private uploadService: IUploadService) {}

  // Upload product image
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
