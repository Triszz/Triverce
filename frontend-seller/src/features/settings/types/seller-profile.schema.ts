import { z } from "zod";

/**
 * VN phone-number regex (Vietnamese landline + mobile).
 *
 * Accepts any valid Vietnamese phone number:
 *  - 10 digits starting with 02, 03, 04, 05, 06, 07, 08, or 09
 *  - 11 digits starting with the same prefixes (some Hanoi/HCMC landlines
 *    use 11-digit numbers such as 024-7300-xxxx)
 *
 * Numeric only — no spaces, dashes, or country code. The form is
 * constrained to numeric input at the UI level (inputMode="numeric"),
 * and length is bounded by `maxLength` on the underlying <input>.
 *
 * The previous regex restricted to mobile prefixes (03, 05, 07, 08, 09)
 * which silently rejected landlines like `0256986324` (HCMC area code
 * 028) and Hanoi (024). This broader pattern reflects real-world
 * Vietnamese numbering and matches the relaxed rule requested in the
 * store settings UX.
 */
const VN_PHONE_REGEX = /^(0[2-9])[0-9]{8,9}$/;

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
 *  - phone: required, valid Vietnamese landline or mobile number
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
      message: "Please enter a valid 10 or 11-digit Vietnamese phone number starting with 0 (e.g. 0901 234 567 or 028 7300 1234)",
    }),

  address: z
    .string()
    .min(1, "Business address is required")
    .min(5, "Business address must be at least 5 characters long"),
});

export type StoreProfileFormValues = z.infer<typeof storeProfileSchema>;
