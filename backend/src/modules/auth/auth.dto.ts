import { z } from "zod";

export const RegisterSchema = z.object({
  email: z.email("Invalid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/[A-Z]/, "At least 1 capital letter is required")
    .regex(/[0-9]/, "At least 1 number is required"),
});

export const LoginSchema = z.object({
  email: z.email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
