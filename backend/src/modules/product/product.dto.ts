import { z } from "zod";
import { slugSchema } from "../../core/utils/slug.schema";

// Variant Schema
const VariantSchema = z.object({
  sku: z
    .string()
    .min(1, "SKU cannot be empty")
    .max(100, "SKU have a maximum of 100 characters")
    .trim(),
  price: z
    .number({ error: "The price must be a number" })
    .int("The price in VND must be an integer")
    .min(1000, "Minimum price 1,000 ₫"),
  imageUrl: z.url("Invalid imageUrl").optional(),
  isActive: z.boolean().default(true),
  // attributes: { "color": "Red", "size": "XL" }
  attributes: z
    .record(
      z.string().min(1), // key: attribute name ("Red")
      z.string().min(1), // Value: attribute value ("XL")
    )
    .refine(
      (attrs) => Object.keys(attrs).length > 0,
      "Variant must have at least one attribute",
    ),
});

// Create Product
export const CreateProductSchema = z.object({
  categoryId: z.uuid("categoryId must a valid UUID").optional(),
  name: z
    .string()
    .min(3, "Product name must have at least 3 characters")
    .max(255, "Product name a maximum of 255 characters")
    .trim(),
  slug: slugSchema(255),
  description: z
    .string()
    .max(5000, "Description have a maximum of 5000 characters")
    .trim()
    .optional(),
  basePrice: z
    .number({ error: "The price must be a number" })
    .int("The price in VND must be an integer")
    .min(1000, "Minimum price 1,000 ₫"),
  isActive: z.boolean().default(true),
  variants: z
    .array(VariantSchema)
    .min(1, "The product must have at least one variant"),
});

// Update Product
export const UpdateProductSchema = CreateProductSchema.omit({ variants: true }) // Cannot change variants here, handle by /products/:id/variants
  .partial();

// Add a variant to existing product
export const AddVariantSchema = VariantSchema;

// Update Variant
export const UpdateVariantSchema = VariantSchema.omit({ attributes: true }) // Cannot change attributes after creation
  .partial();

// Query Params - filter, sort, pagination
export const ProductQuerySchema = z
  .object({
    categoryId: z.uuid().optional(),
    isActive: z
      .string()
      .optional()
      .transform((val) => {
        if (val === "true") return true;
        if (val === "false") return false;
        return undefined;
      }),
    // Search by name
    search: z.string().max(100).trim().optional(),
    // Sort: "price_asc" | "price_desc" | "name_asc" | "created_desc"
    sortBy: z
      .enum([
        "price_asc",
        "price_desc",
        "name_asc",
        "name_desc",
        "created_desc",
      ])
      .default("created_desc"),
    // Filter by price range
    minPrice: z.coerce.number().int().min(0).optional(),
    maxPrice: z.coerce.number().int().min(0).optional(),
    // Pagination
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine(
    (data) => {
      if (data.minPrice !== undefined && data.maxPrice !== undefined) {
        return data.minPrice <= data.maxPrice;
      }
      return true;
    },
    {
      message: "minPrice must not be greater than maxPrice",
      path: ["minPrice"],
    },
  );

export type CreateProductDto = z.infer<typeof CreateProductSchema>;
export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;
export type AddVariantDto = z.infer<typeof AddVariantSchema>;
export type UpdateVariantDto = z.infer<typeof UpdateVariantSchema>;
export type ProductQuery = z.infer<typeof ProductQuerySchema>;
