import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Mail,
  User,
  ShieldCheck,
  Calendar,
  LogIn,
  Save,
  KeyRound,
  Package,
  Lock,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageMeta } from '@/components/common/PageMeta';
import { useAuthStore } from '@/stores/useAuthStore';
import { formatDateLong } from '@/lib/format';
import {
  useUpdateProfile,
  useChangePassword,
  updateProfileFormSchema,
  changePasswordFormSchema,
  type UpdateProfileFormValues,
  type ChangePasswordFormValues,
} from '@/features/account/useAccount';

/* ──────────────────────────────────────────────────────────────────────────
 * AccountPage — interactive, self-service account management.
 *
 * Two working forms, both backed by react-hook-form + Zod and the new
 * PATCH /auth/me/{profile,password} endpoints:
 *
 *   1. Account information  — editable Full Name, locked Email.
 *   2. Change password      — Old / New / Confirm New Password.
 *
 * No "coming soon" banner and no 2FA / Security placeholder — the
 * editable forms replace them.
 *
 * On a successful profile update, `useUpdateProfile` pushes the new
 * `UserPublic` into `useAuthStore`, so the Header, AccountPage, and
 * any other consumer reflect the change with no reload.
 * ──────────────────────────────────────────────── */

const ROLE_META: Record<
  'customer' | 'seller' | 'admin',
  { label: string; tone: 'brand' | 'info' | 'warning' }
> = {
  customer: { label: 'Customer', tone: 'brand' },
  seller: { label: 'Seller', tone: 'info' },
  admin: { label: 'Admin', tone: 'warning' },
};

export function AccountPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  /* ── Unauthenticated ──────────────────────────────────────────────── */

  if (!isAuthenticated || !user) {
    return (
      <>
        <PageMeta
          title="My account"
          description="Sign in to view and manage your Triverce account."
        />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <EmptyState
            tone="brand"
            icon={<LogIn size={24} aria-hidden />}
            title="Sign in to view your account"
            description="We need to know who's looking before we show your profile."
            actions={[
              { label: 'Sign in', href: '/auth/login', variant: 'primary' },
              {
                label: 'Create an account',
                href: '/auth/register',
                variant: 'secondary',
              },
            ]}
          />
        </div>
      </>
    );
  }

  const roleMeta = ROLE_META[user.role] ?? ROLE_META.customer;
  const memberSince = formatDateLong(user.createdAt);

  return (
    <>
      <PageMeta
        title="My account"
        description="View and edit your Triverce profile, full name, and password."
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Header */}
        <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              My account
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Update your profile and password.
            </p>
          </div>
          <Badge tone={roleMeta.tone} size="md">
            {roleMeta.label}
          </Badge>
        </header>

        <ProfileForm
          defaultFullName={user.fullName}
          email={user.email}
          roleLabel={roleMeta.label}
          memberSince={memberSince}
        />

        <div className="mt-6">
          <ChangePasswordForm />
        </div>

        {/* Quick links */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={() => navigate('/orders')}
            leftIcon={<Package size={16} aria-hidden />}
          >
            View my orders
          </Button>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={() => navigate('/cart')}
          >
            View my cart
          </Button>
        </div>
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * ProfileForm — editable fullName + locked email / role / member-since.
 * ──────────────────────────────────────────────── */

interface ProfileFormProps {
  defaultFullName: string;
  email: string;
  roleLabel: string;
  memberSince: string;
}

function ProfileForm({
  defaultFullName,
  email,
  roleLabel,
  memberSince,
}: ProfileFormProps) {
  const updateProfile = useUpdateProfile();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isValid },
  } = useForm<UpdateProfileFormValues>({
    resolver: zodResolver(updateProfileFormSchema),
    defaultValues: { fullName: defaultFullName },
    mode: 'onChange',
  });

  // Keep the form in sync if the user object changes externally
  // (e.g. another tab / the AuthProvider re-hydrating). We only
  // reset when the value actually differs so we don't clobber the
  // user's in-flight edits.
  useEffect(() => {
    reset({ fullName: defaultFullName });
  }, [defaultFullName, reset]);

  const onSubmit = async (values: UpdateProfileFormValues) => {
    try {
      await updateProfile.mutateAsync(values);
      // `useUpdateProfile` already pushes the new user into the
      // auth store and toasts success. Reset the form's dirty
      // state so the "Save changes" button disables.
      reset({ fullName: values.fullName.trim() });
    } catch {
      // Toast already fired from the mutation's onError.
    }
  };

  return (
    <Card padded={false}>
      <header className="px-6 pt-5 pb-4 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-900">
          Account information
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Your name is shown on orders and receipts.
        </p>
      </header>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="px-6 py-5 space-y-5"
      >
        {/* Editable full name */}
        <Input
          label="Full name"
          type="text"
          autoComplete="name"
          leftIcon={<User size={16} aria-hidden />}
          error={errors.fullName?.message}
          {...register('fullName')}
        />

        {/* Locked-down fields */}
        <ReadOnlyField
          icon={<Mail size={16} />}
          label="Email address"
          value={email}
          help="Email is tied to your login. Contact support to change it."
        />
        <ReadOnlyField
          icon={<ShieldCheck size={16} />}
          label="Role"
          value={roleLabel}
        />
        <ReadOnlyField
          icon={<Calendar size={16} />}
          label="Member since"
          value={memberSince}
          isLast
        />

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={updateProfile.isPending}
            disabled={!isDirty || !isValid || updateProfile.isPending}
            leftIcon={<Save size={16} aria-hidden />}
          >
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * ChangePasswordForm — old / new / confirm new password.
 * ──────────────────────────────────────────────── */

function ChangePasswordForm() {
  const changePassword = useChangePassword();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid, isSubmitSuccessful },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: {
      oldPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
    mode: 'onChange',
  });

  // Wipe the form once a successful submit lands so the user doesn't
  // walk away with their new password still in a visible input.
  useEffect(() => {
    if (isSubmitSuccessful) {
      reset({
        oldPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
    }
  }, [isSubmitSuccessful, reset]);

  const onSubmit = async (values: ChangePasswordFormValues) => {
    try {
      await changePassword.mutateAsync({
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
        confirmNewPassword: values.confirmNewPassword,
      });
    } catch {
      // Toast already fired from the mutation's onError. Keep the
      // user's current values in the form so they can correct the
      // old password and retry.
    }
  };

  return (
    <Card padded={false}>
      <header className="px-6 pt-5 pb-4 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-900">
          Change password
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Use at least 8 characters with 1 capital letter and 1 number.
        </p>
      </header>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="px-6 py-5 space-y-4"
      >
        <Input
          label="Current password"
          type="password"
          autoComplete="current-password"
          leftIcon={<Lock size={16} aria-hidden />}
          error={errors.oldPassword?.message}
          {...register('oldPassword')}
        />
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          leftIcon={<KeyRound size={16} aria-hidden />}
          error={errors.newPassword?.message}
          hint="At least 8 characters, with 1 capital letter and 1 number."
          {...register('newPassword')}
        />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          leftIcon={<KeyRound size={16} aria-hidden />}
          error={errors.confirmNewPassword?.message}
          {...register('confirmNewPassword')}
        />

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={changePassword.isPending}
            disabled={!isValid || changePassword.isPending}
            leftIcon={<Save size={16} aria-hidden />}
          >
            Update password
          </Button>
        </div>
      </form>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * ReadOnlyField — labelled, non-editable value used for Email / Role /
 * Member-since rows. Visual language matches the old `Field` so the
 * page still feels familiar.
 * ──────────────────────────────────────────────── */

interface ReadOnlyFieldProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  help?: string;
  isLast?: boolean;
}

function ReadOnlyField({
  icon,
  label,
  value,
  help,
  isLast = false,
}: ReadOnlyFieldProps) {
  return (
    <div
      className={
        isLast
          ? 'grid grid-cols-1 sm:grid-cols-[180px,1fr] gap-1 sm:gap-4'
          : 'grid grid-cols-1 sm:grid-cols-[180px,1fr] gap-1 sm:gap-4 border-t border-slate-100 pt-4'
      }
    >
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
        <span className="text-slate-400">{icon}</span>
        {label}
      </div>
      <div className="space-y-0.5">
        <div className="text-sm text-slate-900 font-medium break-words">
          {value}
        </div>
        {help && <p className="text-xs text-slate-500">{help}</p>}
      </div>
    </div>
  );
}
