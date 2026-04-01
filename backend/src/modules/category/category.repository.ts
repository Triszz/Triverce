import { Kysely } from "kysely";
import {
  DatabaseSchema,
  NewCategory,
  CategoryUpdate,
} from "../../infrastructure/database/db.schema";
import { CategoryEntity } from "./category.entity";
import { CategoryQuery } from "./category.dto";

export class CategoryRepository {
  constructor(private db: Kysely<DatabaseSchema>) {}

  // Find all categories
  async findAll(
    query: CategoryQuery,
  ): Promise<{ data: CategoryEntity[]; total: number }> {
    let baseQuery = this.db.selectFrom("categories");

    // Filters
    if (query.parentId !== undefined) {
      baseQuery = baseQuery.where(
        "parent_id",
        "=",
        query.parentId,
      ) as typeof baseQuery;
    }
    if (query.isActive !== undefined) {
      baseQuery = baseQuery.where(
        "is_active",
        "=",
        query.isActive,
      ) as typeof baseQuery;
    }

    // Total count (for pagination)
    const { count } = await baseQuery
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .executeTakeFirstOrThrow();

    // Data filter pagination
    const rows = await baseQuery
      .selectAll()
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "desc")
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)
      .execute();

    return {
      data: rows.map(CategoryEntity.fromDatabase),
      total: Number(count),
    };
  }

  // Find category by id
  async findById(id: string): Promise<CategoryEntity | null> {
    const row = await this.db
      .selectFrom("categories")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? CategoryEntity.fromDatabase(row) : null;
  }

  // Find category by slug
  async findBySlug(slug: string): Promise<CategoryEntity | null> {
    const row = await this.db
      .selectFrom("categories")
      .selectAll()
      .where("slug", "=", slug)
      .executeTakeFirst();

    return row ? CategoryEntity.fromDatabase(row) : null;
  }

  // Create category
  async create(
    data: Omit<NewCategory, "id" | "created_at" | "updated_at">,
  ): Promise<CategoryEntity> {
    const row = await this.db
      .insertInto("categories")
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow();

    return CategoryEntity.fromDatabase(row);
  }

  // Update category
  async update(
    id: string,
    data: CategoryUpdate,
  ): Promise<CategoryEntity | null> {
    const row = await this.db
      .updateTable("categories")
      .set({ ...data, updated_at: new Date() })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    return row ? CategoryEntity.fromDatabase(row) : null;
  }

  // Delete category
  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom("categories")
      .where("id", "=", id)
      .executeTakeFirst();

    return Number(result.numDeletedRows) > 0;
  }

  // Count children of category
  async countChildren(parentId: string): Promise<number> {
    const { count } = await this.db
      .selectFrom("categories")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("parent_id", "=", parentId)
      .executeTakeFirstOrThrow();

    return Number(count);
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    let query = this.db
      .selectFrom("categories")
      .select("id")
      .where("slug", "=", slug);

    if (excludeId) {
      query = query.where("id", "!=", excludeId);
    }

    const row = await query.executeTakeFirst();
    return !!row;
  }
}
