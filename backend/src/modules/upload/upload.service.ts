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
  }

  // Upload product image
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
