import { z } from "zod";

export const CreateOrderSchema = z.object({
  shippingName: z.string().trim().min(2, "Shipping name is required"),
  shippingPhone: z
    .string()
    .trim()
    .regex(/^[0-9]{9,11}$/, "Invalid phone number"),
  shippingAddress: z.string().trim().min(10, "Address is too short"),
  note: z.string().trim().max(500).optional(),
  gateway: z.enum(["momo", "stripe", "vnpay", "cod"]).default("momo"),
  returnUrl: z.url(),
  cancelUrl: z.url(),
  /**
   * Optional list of cart-item IDs to checkout. When supplied, the
   * service restricts the checkout to only these items (the rest of
   * the cart stays untouched so the buyer can come back for them
   * later). When omitted, the entire active cart is checked out —
   * preserving the pre-multi-vendor behaviour.
   *
   * Each ID must be a UUID; max 100 items per request is a loose
   * sanity check that prevents a runaway payload from DoS'ing the
   * server.
   */
  cartItemIds: z.array(z.uuid()).max(100).optional(),
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
