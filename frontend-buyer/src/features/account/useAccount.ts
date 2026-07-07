import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';
import { z } from 'zod';
import {
  authService,
  type UserPublic,
  type UpdateProfilePayload,
  type ChangePasswordPayload,
} from '@/services/authService';
import { useAuthStore } from '@/stores/useAuthStore';

/* ──────────────────────────────────────────────────────────────────────────
 * Zod schemas — mirror the backend `UpdateProfileSchema` and
 * `ChangePasswordSchema` and add the form-level rules the backend
 * doesn't need to know about (the "Confirm new password" field, the
 * "new password must differ from old" rule, etc.).
 * ──────────────────────────────────────────────── */

/** Editable profile form. */
export const updateProfileFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(255, 'Full name must be 255 characters or fewer'),
});
export type UpdateProfileFormValues = z.infer<typeof updateProfileFormSchema>;

/** Change-password form. */
export const changePasswordFormSchema = z
  .object({
    oldPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'At least 1 capital letter is required')
      .regex(/[0-9]/, 'At least 1 number is required'),
    confirmNewPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'New passwords do not match',
    path: ['confirmNewPassword'],
  })
  .refine((data) => data.oldPassword !== data.newPassword, {
    message: 'New password must be different from the current one',
    path: ['newPassword'],
  });
export type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>;

/* ──────────────────────────────────────────────────────────────────────────
 * Error helpers
 * ──────────────────────────────────────────────── */

/** Pull a human-readable error string out of an unknown thrown value. */
function formatError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    // Zod validation errors come back as `errors: [{ field, message }]`.
    const data = err.response?.data as
      | { message?: string; errors?: { message: string }[] }
      | undefined;
    if (data?.errors && data.errors.length > 0) {
      return data.errors.map((e) => e.message).join(' • ');
    }
    if (data?.message) return data.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

/* ──────────────────────────────────────────────────────────────────────────
 * useUpdateProfile — PATCH /auth/me/profile
 *
 *   • On success: pushes the fresh UserPublic into the auth store so
 *     the Header, AccountPage, etc. reflect the new name instantly.
 *   • On error: surfaces a single, descriptive toast.
 * ──────────────────────────────────────────────── */

export function useUpdateProfile(): UseMutationResult<
  UserPublic,
  unknown,
  UpdateProfileFormValues
> {
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: (values: UpdateProfileFormValues): Promise<UserPublic> =>
      authService.updateProfile({ fullName: values.fullName } satisfies UpdateProfilePayload),
    onSuccess: (user) => {
      setUser(user);
      toast.success('Profile updated', {
        description: `Welcome back, ${user.fullName.split(' ')[0]}.`,
      });
    },
    onError: (err) => {
      toast.error('Could not update profile', {
        description: formatError(err, 'Please try again in a moment.'),
      });
    },
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * useChangePassword — PATCH /auth/me/password
 *
 *   • Returns void on success; toasts a confirmation.
 *   • On a 401 (wrong old password) the message we surface in the toast
 *     is the same one the backend returns: "Current password is
 *     incorrect" — the form's Zod schema can't see that, only the
 *     server can.
 * ──────────────────────────────────────────────── */

export function useChangePassword(): UseMutationResult<
  void,
  unknown,
  ChangePasswordFormValues
> {
  return useMutation({
    mutationFn: (values: ChangePasswordFormValues): Promise<void> =>
      authService.changePassword({
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      } satisfies ChangePasswordPayload),
    onSuccess: () => {
      toast.success('Password updated', {
        description: 'Use your new password the next time you sign in.',
      });
    },
    onError: (err) => {
      toast.error('Could not change password', {
        description: formatError(
          err,
          'Please check your current password and try again.',
        ),
      });
    },
  });
}
