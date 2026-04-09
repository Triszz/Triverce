import { z } from "zod";

// Update quantity
export const UpdateInventorySchema = z.object({
  quantity: z
    .number({ error: "Quantity must be a number" })
    .int("Quantity must be an integer")
    .min(0, "Quantity cannot be negative"),
});

// Adjust inventory
export const AdjustInventorySchema = z.object({
  delta: z
    .number({ error: "Delta must be a number" })
    .int("Delta must be an integer")
    .refine((v) => v !== 0, "Delta cannot be zero"),
  reason: z.string().max(255).trim().optional(),
});

export type UpdateInventoryDto = z.infer<typeof UpdateInventorySchema>;
export type AdjustInventoryDto = z.infer<typeof AdjustInventorySchema>;
