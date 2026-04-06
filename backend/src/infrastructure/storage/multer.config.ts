import multer, { FileFilterCallback } from "multer";
import { Request } from "express";
import { BadRequestError } from "../../core/errors/AppError";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 5;

export const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_SIZE_MB * 1024 * 1024,
  },

  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback,
  ) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestError(
          `Invalid file type "${file.mimetype}". Only JPEG, PNG, WebP are allowed.`,
        ) as any,
      );
    }
  },
});
