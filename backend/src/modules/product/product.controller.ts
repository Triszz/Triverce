import { z } from "zod";

/**
 * Schema for `PUT /api/products/:id/images` — the dashboard's "set the
 * final gallery" endpoint.
 *
 * Why not `z.url()`: the upload service returns **relative** paths like
 * `/uploads/products/<productId>-<ts>.webp`. The browser renders them
 * with the API origin prepended, and storing absolute URLs would break
 * every existing record if the backend host ever changes (e.g. moving
 * from `localhost:3000` to a production domain, or swapping CDN).
 * Relative paths also keep the DB row portable across environments.
 *
 * Instead we enforce:
 *   • 0–20 entries (matches the upload controller's `array('images', 10)`
 *     plus headroom for legacy products).
 *   • Each entry is a non-empty string ≤ 2048 chars. We accept either a
 *     relative `/uploads/...` path or a fully-qualified URL — both are
 *     valid sources of truth because the dashboard may someday seed
 *     images from an external CDN.
 */
const SetProductImagesSchema = z.object({
  images: z
    .array(
      z
        .string()
        .min(1, "Image URL cannot be empty")
        .max(2048, "Image URL is too long"),
    )
    .max(20, "Maximum of 20 images per product"),
});

import { Request, Response, NextFunction } from "express";
import { ProductService } from "./product.service";
import {
  CreateProductDto,
  UpdateProductDto,
  ProductQuery,
  AddVariantDto,
  UpdateVariantDto,
} from "./product.dto";

export class ProductController {
  constructor(private productService: ProductService) {}

  // Get products (filter)
  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as ProductQuery;
      const result = await this.productService.getAll(query);
      res.status(200).json({
        success: true,
        data: result.data.map((p) => p.toPublicSummary()),
        meta: { total: result.total, page: query.page, limit: query.limit },
      });
    } catch (error) {
      next(error);
    }
  };

  // Get product by id
  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await this.productService.getById(
        req.params.id as string,
      );
      res.status(200).json({
        success: true,
        data: product.toPublicDetail(),
      });
    } catch (error) {
      next(error);
    }
  };

  // Get product by slug
  getBySlug = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await this.productService.getBySlug(
        req.params.slug as string,
      );
      res.status(200).json({
        success: true,
        data: product.toPublicDetail(),
      });
    } catch (error) {
      next(error);
    }
  };

  // Create product
  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await this.productService.create(
        req.body as CreateProductDto,
        req.user!.userId,
      );
      res.status(201).json({
        success: true,
        data: product.toPublicDetail(),
      });
    } catch (error) {
      next(error);
    }
  };

  // Update product
  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await this.productService.update(
        req.params.id as string,
        req.body as UpdateProductDto,
        req.user!,
      );
      res.status(200).json({
        success: true,
        data: product.toPublicDetail(),
      });
    } catch (error) {
      next(error);
    }
  };

  // Delete product
  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.productService.delete(req.params.id as string, req.user!);
      res.status(200).json({
        success: true,
        message: "Product deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  // Add variant
  addVariant = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const variant = await this.productService.addVariant(
        req.params.id as string,
        req.body as AddVariantDto,
        req.user!,
      );
      res.status(201).json({
        success: true,
        data: variant.toPublic(),
      });
    } catch (error) {
      next(error);
    }
  };

  // Update variant
  updateVariant = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Structured log so we can see exactly what the frontend sent before
      // Zod validation runs. Useful for debugging silent-attribute-drop
      // issues without needing to instrument the schema itself.
      console.log("[updateVariant] raw req.body:", JSON.stringify(req.body));
      const variant = await this.productService.updateVariant(
        req.params.id as string,
        req.params.vid as string,
        req.body as UpdateVariantDto,
        req.user!,
      );
      res.status(200).json({
        success: true,
        data: variant.toPublic(),
      });
    } catch (error) {
      next(error);
    }
  };

  // Set the entire gallery array (drag-to-reorder, remove). Validates
  // the URL list and persists via the service. Returns the final list.
  //
  // Wire format (matches `productService.setProductImages` and the
  // frontend `productService.setProductImages` helper):
  //
  //   PUT /api/products/:id/images
  //   { "images": ["/uploads/products/abc.webp", "..."] }
  //
  // Anything other than `{ images: string[] }` is rejected with 400 +
  // a structured Zod error so the dashboard can render it.
  setImages = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Explicit destructuring per the API contract. We log the
      // received shape on parse failure so a future mismatch between
      // frontend and backend (e.g. someone wraps the body one extra
      // time) is diagnosable from the server log alone.
      const parsed = SetProductImagesSchema.safeParse(req.body);
      if (!parsed.success) {
        const received = {
          type: typeof req.body,
          isArray: Array.isArray(req.body),
          keys:
            req.body && typeof req.body === "object"
              ? Object.keys(req.body as Record<string, unknown>)
              : [],
        };
        return res.status(400).json({
          success: false,
          message: "Invalid image list — expected { images: string[] }",
          received,
          errors: parsed.error.flatten(),
        });
      }
      const { images } = parsed.data;
      const next = await this.productService.setProductImages(
        req.params.id as string,
        images,
        req.user!,
      );
      res.status(200).json({ success: true, data: { images: next } });
    } catch (error) {
      next(error);
    }
  };

  // Delete variant
  deleteVariant = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.productService.deleteVariant(
        req.params.id as string,
        req.params.vid as string,
        req.user!,
      );
      res.status(200).json({
        success: true,
        message: "Variant deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };
}
