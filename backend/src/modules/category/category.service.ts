import { CategoryRepository } from "./category.repository";
import { CategoryEntity } from "./category.entity";
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryQuery,
} from "./category.dto";
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
} from "../../core/errors/AppError";

export class CategoryService {
  constructor(private categoryRepository: CategoryRepository) {}

  // Get categories (filter)
  async getAll(
    query: CategoryQuery,
  ): Promise<{ data: CategoryEntity[]; total: number }> {
    return this.categoryRepository.findAll(query);
  }

  // Get category by id
  async getById(id: string): Promise<CategoryEntity> {
    const category = await this.categoryRepository.findById(id);
    if (!category)
      throw new NotFoundError(`Category with id "${id}" not found`);
    return category;
  }

  // Get category by slug
  async getBySlug(slug: string): Promise<CategoryEntity> {
    const category = await this.categoryRepository.findBySlug(slug);
    if (!category)
      throw new NotFoundError(`Category with slug "${slug}" not found`);
    return category;
  }

  // Create category
  async create(dto: CreateCategoryDto): Promise<CategoryEntity> {
    // Check duplicate slug
    const slugTaken = await this.categoryRepository.slugExists(dto.slug);
    if (slugTaken) throw new ConflictError(`Slug "${dto.slug}"already exists`);

    // Check invalid parentId
    if (dto.parentId) {
      const parent = await this.categoryRepository.findById(dto.parentId);
      if (!parent)
        throw new NotFoundError(
          `Parent category with id "${dto.parentId}" not found`,
        );
    }

    return this.categoryRepository.create({
      name: dto.name,
      slug: dto.slug,
      description: dto.description ?? null,
      parent_id: dto.parentId ?? null,
      is_active: dto.isActive,
      sort_order: dto.sortOrder,
    });
  }

  // Update category
  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryEntity> {
    const existing = await this.categoryRepository.findById(id);
    if (!existing)
      throw new NotFoundError(`Category with id "${id}" not found`);

    // Check duplicate slug (except itself)
    if (dto.slug) {
      const slugTaken = await this.categoryRepository.slugExists(dto.slug, id);
      if (slugTaken)
        throw new ConflictError(`Slug "${dto.slug}" already exists`);
    }

    // Check invalid parentId
    if (dto.parentId) {
      // Not allow to set parentId = itself
      if (dto.parentId === id)
        throw new BadRequestError(`Category cannot be its own parent`);

      // Not allow to set parentId = its child
      let currentCheckId: string | null = dto.parentId;
      while (currentCheckId) {
        const parentCategory =
          await this.categoryRepository.findById(currentCheckId);
        if (!parentCategory)
          throw new NotFoundError(
            `Data corruption: Ancestor category with id "${currentCheckId}" not found`,
          );
        if (parentCategory.parentId === id) {
          throw new BadRequestError(
            `Circular reference detected: Cannot set a descendant as a parent`,
          );
        }
        currentCheckId = parentCategory.parentId;
      }
    }

    const updated = await this.categoryRepository.update(id, {
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      parent_id: dto.parentId,
      is_active: dto.isActive,
      sort_order: dto.sortOrder,
    });

    return updated!;
  }

  // Delete category
  async delete(id: string): Promise<void> {
    const existing = await this.categoryRepository.findById(id);
    if (!existing)
      throw new NotFoundError(`Category with id "${id}" not found`);

    // Check if category has a child category
    const childCount = await this.categoryRepository.countChildren(id);
    if (childCount > 0) {
      throw new BadRequestError(
        `Cannot delete: this category has ${childCount} ${childCount > 1 ? "subcategories" : "subcategory"}. Please delete ${childCount > 1 ? "them" : "it"} first.`,
      );
    }
    await this.categoryRepository.delete(id);
  }
}
