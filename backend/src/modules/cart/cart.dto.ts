import { z } from "zod";

export const AddCartItemSchema = z.object({
  variantId: z.uuid("VariantId must be a valid UUID"),
  quantity: z
    .number({ error: "Quantity must be a number" })
    .int("Quantity must be an integer")
    .min(1, "Minimum quantity is 1")
    .max(100, "Maximum quantity per item is 100"),
});

export const UpdateCartItemSchema = z.object({
  quantity: z
    .number({ error: "Quantity must be a number" })
    .int("Quantity must be an integer")
    .min(1, "Minimum quantity is 1")
    .max(100, "Maximum quantity per item is 100"),
  /** Optional — when supplied the item's variant is switched to this ID.
   *  The caller is responsible for validating that `variantId` is a
   *  valid, in-stock variant of the same product. */
  variantId: z.string().uuid("variantId must be a valid UUID").optional(),
});

export type AddCartItemDto = z.infer<typeof AddCartItemSchema>;
export type UpdateCartItemDto = z.infer<typeof UpdateCartItemSchema>;
