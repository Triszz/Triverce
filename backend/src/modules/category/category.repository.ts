import { PrismaClient, Prisma } from "@prisma/client";
import { CategoryEntity } from "./category.entity";
import type { CategoryQuery } from "./category.dto";

/**
 * CategoryRepository — Prisma-backed.
 *
 * Public API unchanged from the Kysely version.
 * All entity construction is done via CategoryEntity.fromDatabase(row).
 *
 * `create` / `update` accept the same payload shape the service used to
 * pass to Kysely's NewCategory / CategoryUpdate (camelCase DTO fields,
 * e.g. `parentId` rather than the relation field `parent`). The repo
 * internally translates to Prisma's `parent: { connect: { id } }`.
 */
export interface UpdateCategoryPayload {
  name?: string;
  slug?: string;
  description?: string | null;
  parentId?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export class CategoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(
    query: CategoryQuery,
  ): Promise<{ data: CategoryEntity[]; total: number }> {
    const where: Prisma.CategoryWhereInput = {};
    if (query.parentId !== undefined) where.parentId = query.parentId;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const [total, rows] = await Promise.all([
      this.prisma.category.count({ where }),
      this.prisma.category.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      data: rows.map(CategoryEntity.fromDatabase),
      total,
    };
  }

  async findById(id: string): Promise<CategoryEntity | null> {
    const row = await this.prisma.category.findUnique({ where: { id } });
    return row ? CategoryEntity.fromDatabase(row) : null;
  }

  async findBySlug(slug: string): Promise<CategoryEntity | null> {
    const row = await this.prisma.category.findUnique({
      where: { slug, isActive: true },
    });
    return row ? CategoryEntity.fromDatabase(row) : null;
  }

  async create(data: {
    name: string;
    slug: string;
    description: string | null;
    parentId: string | null;
    isActive: boolean;
    sortOrder: number;
  }): Promise<CategoryEntity> {
    const row = await this.prisma.category.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        ...(data.parentId !== null
          ? { parent: { connect: { id: data.parentId } } }
          : {}),
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      },
    });
    return CategoryEntity.fromDatabase(row);
  }

  async update(
    id: string,
    data: UpdateCategoryPayload,
  ): Promise<CategoryEntity | null> {
    try {
      const updateData: Prisma.CategoryUpdateInput = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.slug !== undefined) updateData.slug = data.slug;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.parentId !== undefined) {
        if (data.parentId === null) {
          updateData.parent = { disconnect: true };
        } else {
          updateData.parent = { connect: { id: data.parentId } };
        }
      }
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

      const row = await this.prisma.category.update({
        where: { id },
        data: updateData,
      });
      return CategoryEntity.fromDatabase(row);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.category.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async countChildren(parentId: string): Promise<number> {
    return this.prisma.category.count({ where: { parentId } });
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const found = await this.prisma.category.findFirst({
      where: {
        slug,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    return !!found;
  }
}
