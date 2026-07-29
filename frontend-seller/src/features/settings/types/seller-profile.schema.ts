import { z } from "zod";

/**
 * VN mobile regex:
 * - Must start with 03, 05, 07, 08, or 09
 * - Followed by exactly 8 remaining digits
 * - Total: 10 digits
 */
const VN_PHONE_REGEX = /^(0[3|5|7|8|9])+([0-9]{8})\b/;

/**
 * Validation schema for the Seller Store Settings form.
 *
 * Mirrors the `StoreProfile` type but adds runtime validation rules
 * that the API schema doesn't enforce.
 *
 * All rules match the requirements:
 *  - storeName: 2–50 chars, required
 *  - description: optional, max 500 chars
 *  - supportEmail: required, valid email
 *  - phone: required, VN mobile format
 *  - address: required, minimum 5 characters
 */
export const storeProfileSchema = z.object({
  storeName: z
    .string()
    .min(1, "Store name is required")
    .min(2, "Store name must be at least 2 characters")
    .max(50, "Store name must be 50 characters or fewer"),

  description: z
    .string()
    .max(500, "Description must be 500 characters or fewer"),

  logoUrl: z.string().optional(),

  supportEmail: z
    .string()
    .min(1, "Support email is required")
    .email("Enter a valid email address (e.g. support@yourstore.com)"),

  phone: z
    .string()
    .min(1, "Phone number is required")
    .regex(VN_PHONE_REGEX, {
      message: "Please enter a valid Vietnamese phone number (10 digits starting with 03, 05, 07, 08, or 09)",
    }),

  address: z
    .string()
    .min(1, "Business address is required")
    .min(5, "Business address must be at least 5 characters long"),
});

export type StoreProfileFormValues = z.infer<typeof storeProfileSchema>;
