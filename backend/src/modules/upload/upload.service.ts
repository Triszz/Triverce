import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import {
  IUploadService,
  UploadResult,
} from "../../core/interfaces/IUploadService";
import { BadRequestError } from "../../core/errors/AppError";

export class LocalUploadService implements IUploadService {
  private readonly baseDir: string;
  private readonly publicPath: string;

  constructor() {
    // Save in folder uploads/ at root project
    this.baseDir = path.join(process.cwd(), "uploads");
    this.publicPath = "/uploads";
  }

  // Initialize directory if not exist
  async init(): Promise<void> {
    await fs.mkdir(path.join(this.baseDir, "products"), { recursive: true });
    await fs.mkdir(path.join(this.baseDir, "variants"), { recursive: true });
    await fs.mkdir(path.join(this.baseDir, "logos"), { recursive: true });
  }

  /**
   * Upload multiple images for a product. Order is preserved — file at
   * index N becomes the URL at position N of the returned `images[]`.
   * Maximum 10 files per request (enforced by `upload.array('images', 10)`).
   *
   * Persistence happens in the controller (which has access to the
   * product service for ownership checks). This service is the I/O
   * layer only.
   */
  async uploadProductImages(
    files: Express.Multer.File[],
    productId: string,
  ): Promise<UploadResult[]> {
    if (!Array.isArray(files) || files.length === 0) {
      throw new BadRequestError("No files uploaded");
    }
    const results: UploadResult[] = [];
    for (const file of files) {
      results.push(
        await this.processAndSave(file, "products", productId, {
          width: 800,
          height: 800,
          quality: 85,
        }),
      );
    }
    return results;
  }

  // Legacy single-image call (kept for backwards-compat callers).
  async uploadProductImage(
    file: Express.Multer.File,
    productId: string,
  ): Promise<UploadResult> {
    return this.processAndSave(file, "products", productId, {
      width: 800,
      height: 800,
      quality: 85,
    });
  }

  // Upload variant image
  async uploadVariantImage(
    file: Express.Multer.File,
    variantId: string,
  ): Promise<UploadResult> {
    return this.processAndSave(file, "variants", variantId, {
      width: 600,
      height: 600,
      quality: 85,
    });
  }

  // Upload store logo.
  //
  // SVG files are skipped from sharp processing — vector graphics must not be
  // rasterised or converted to WebP; they are saved as-is with a .svg extension.
  // Raster files (JPEG / PNG / WebP) are processed normally and converted to
  // WebP for consistent output.
  async uploadLogo(
    file: Express.Multer.File,
    sellerId: string,
  ): Promise<UploadResult> {
    if (!file.buffer) {
      throw new BadRequestError("No file buffer found");
    }

    const isSvg = file.mimetype === "image/svg+xml";
    const timestamp = Date.now();
    const filename = `${sellerId}-${timestamp}${isSvg ? ".svg" : ".webp"}`;
    const savePath = path.join(this.baseDir, "logos", filename);

    if (isSvg) {
      // Write SVG directly — no sharp processing needed.
      await fs.writeFile(savePath, file.buffer);
      return {
        url: `${this.publicPath}/logos/${filename}`,
        fileName: `logos/${filename}`,
        originalName: file.originalname,
        size: file.buffer.length,
        mimeType: "image/svg+xml",
      };
    }

    // Raster images: resize + convert to WebP.
    const outputBuffer = await sharp(file.buffer)
      .resize(256, 256, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    await fs.writeFile(savePath, outputBuffer);
    return {
      url: `${this.publicPath}/logos/${filename}`,
      fileName: `logos/${filename}`,
      originalName: file.originalname,
      size: outputBuffer.length,
      mimeType: "image/webp",
    };
  }

  // Delete file
  async deleteFile(filename: string): Promise<boolean> {
    // filename: "products/abc123.webp"
    const fullPath = path.join(this.baseDir, filename);
    if (!fullPath.startsWith(this.baseDir)) {
      throw new BadRequestError("Invalid filename");
    }
    try {
      await fs.unlink(fullPath);
      return true;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return false;
      }
      throw error;
    }
  }

  // Helpers
  private async processAndSave(
    file: Express.Multer.File,
    folder: string,
    id: string,
    options: { width: number; height: number; quality: number },
  ): Promise<UploadResult> {
    if (!file.buffer) {
      throw new BadRequestError("No file buffer found");
    }

    // filename: productId-timestamp.webp
    const filename = `${id}-${Date.now()}.webp`;
    const savePath = path.join(this.baseDir, folder, filename);

    // Resize + convert to WebP to optimize memory
    const outputBuffer = await sharp(file.buffer)
      .resize(options.width, options.height, {
        fit: "inside", // do not crop
        withoutEnlargement: true, // do not enlarge small images
      })
      .webp({ quality: options.quality })
      .toBuffer();

    await fs.writeFile(savePath, outputBuffer);

    return {
      url: `${this.publicPath}/${folder}/${filename}`,
      fileName: `${folder}/${filename}`,
      originalName: file.originalname,
      size: outputBuffer.length,
      mimeType: "image/webp",
    };
  }
}
