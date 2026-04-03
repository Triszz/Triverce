import { Request, Response, NextFunction } from "express";
import { CategoryService } from "./category.service";
import {
  CategoryQuery,
  CreateCategoryDto,
  UpdateCategoryDto,
} from "./category.dto";

export class CategoryController {
  constructor(private categoryService: CategoryService) {}

  // Get categories (filter)
  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as CategoryQuery;
      const result = await this.categoryService.getAll(query);
      res.status(200).json({
        success: true,
        data: result.data.map((c) => c.toPublic()),
        meta: { total: result.total, page: query.page, limit: query.limit },
      });
    } catch (error) {
      next(error);
    }
  };

  // Get category by id
  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await this.categoryService.getById(
        req.params.id as string,
      );
      res.status(200).json({
        success: true,
        data: category.toPublic(),
      });
    } catch (error) {
      next(error);
    }
  };

  // Get category by slug
  getBySlug = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await this.categoryService.getBySlug(
        req.params.slug as string,
      );
      res.json({ success: true, data: category.toPublic() });
    } catch (err) {
      next(err);
    }
  };

  // Create category
  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await this.categoryService.create(
        req.body as CreateCategoryDto,
      );
      res.status(201).json({
        success: true,
        data: category.toPublic(),
      });
    } catch (error) {
      next(error);
    }
  };

  // Update category
  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await this.categoryService.update(
        req.params.id as string,
        req.body as UpdateCategoryDto,
      );
      res.status(200).json({
        success: true,
        data: category.toPublic(),
      });
    } catch (error) {
      next(error);
    }
  };

  // Delete category
  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.categoryService.delete(req.params.id as string);
      res.status(200).json({
        success: true,
        message: "Category deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };
}
