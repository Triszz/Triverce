import { z } from "zod";
import { slugSchema } from "../../core/utils/slug.schema";

// Create Category
export const CreateCategorySchema = z.object({
  name: z
    .string()
    .min(2, "Category name must have at least 2 characters")
    .max(100, "Category name have a maximum of 100 characters")
    .trim(),
  slug: slugSchema(100),
  description: z
    .string()
    .max(500, "Description have a maximum of 500 characters")
    .trim()
    .optional(),
  parentId: z.uuid("parentId must a valid UUID").optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

// Update Category
export const UpdateCategorySchema = CreateCategorySchema.partial();

// Query Params - List Filter
export const CategoryQuerySchema = z.object({
  parentId: z.uuid().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined;
    }),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateCategoryDto = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryDto = z.infer<typeof UpdateCategorySchema>;
export type CategoryQuery = z.infer<typeof CategoryQuerySchema>;
