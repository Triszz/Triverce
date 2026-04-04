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
