import { CategoryRow } from "../../infrastructure/database/db.schema";

export class CategoryEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly slug: string,
    public readonly description: string | null,
    public readonly parentId: string | null,
    public readonly isActive: boolean,
    public readonly sortOrder: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  // Business rules
  isRootCategory(): boolean {
    return this.parentId === null;
  }

  isVisible(): boolean {
    return this.isActive;
  }

  static fromDatabase(row: CategoryRow): CategoryEntity {
    return new CategoryEntity(
      row.id,
      row.name,
      row.slug,
      row.description,
      row.parent_id,
      row.is_active,
      row.sort_order,
      new Date(row.created_at),
      new Date(row.updated_at),
    );
  }

  toPublic() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      description: this.description,
      parentId: this.parentId,
      isActive: this.isActive,
      sortOrder: this.sortOrder,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
