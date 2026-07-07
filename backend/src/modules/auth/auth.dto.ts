import { z } from "zod";

export const RegisterSchema = z.object({
  email: z.email("Invalid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/[A-Z]/, "At least 1 capital letter is required")
    .regex(/[0-9]/, "At least 1 number is required"),
  fullName: z.string().min(2).max(255),
  role: z.enum(["customer", "seller", "admin"]).default("customer"),
});

export const LoginSchema = z.object({
  email: z.email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

/**
 * UpdateProfileSchema — the only field a user can edit on themselves today
 * is `fullName` (email is the stable identity for login / refresh, and
 * the schema for email change has its own verification flow that we
 * don't ship yet).
 *
 * Constraints mirror the register schema so existing accounts can't
 * end up with display names shorter than 2 chars.
 */
export const UpdateProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(255, "Full name must be 255 characters or fewer"),
});

/**
 * ChangePasswordSchema — current password for verification, new password
 * for the same strength rules we enforce at registration. We don't ask
 * the user to retype the new password; the API is consumed from a form
 * that handles confirm-password on the client.
 */
export const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/[A-Z]/, "At least 1 capital letter is required")
    .regex(/[0-9]/, "At least 1 number is required"),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;
