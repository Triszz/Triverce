import type { Category } from "@prisma/client";

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

  isRootCategory(): boolean {
    return this.parentId === null;
  }

  isVisible(): boolean {
    return this.isActive;
  }

  static fromDatabase(row: Category): CategoryEntity {
    return new CategoryEntity(
      row.id,
      row.name,
      row.slug,
      row.description,
      row.parentId,
      row.isActive,
      row.sortOrder,
      row.createdAt,
      row.updatedAt,
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
