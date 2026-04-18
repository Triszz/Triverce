import { z } from "zod";

export const CreateOrderSchema = z.object({
  shippingName: z.string().trim().min(2, "Shipping name is required"),
  shippingPhone: z
    .string()
    .trim()
    .regex(/^[0-9]{9,11}$/, "Invalid phone number"),
  shippingAddress: z.string().trim().min(10, "Address is too short"),
  note: z.string().trim().max(500).optional(),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(["confirmed", "shipping", "delivered", "cancelled"]),
  note: z.string().trim().max(500).optional(),
});

export const CancelOrderSchema = z.object({
  reason: z.string().trim().min(5, "Please provide a cancellation reason"),
});

export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderStatusDto = z.infer<typeof UpdateOrderStatusSchema>;
export type CancelOrderDto = z.infer<typeof CancelOrderSchema>;
