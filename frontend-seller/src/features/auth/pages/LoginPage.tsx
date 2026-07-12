import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';
import apiClient from '@/lib/apiClient';
import { useAuthStore, type UserPublic } from '@/stores/useAuthStore';

// ── Validation schema ────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Enter a valid email address'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// ── API response envelope (mirrors backend) ──────────────────────────────
interface ApiSuccess<T> {
  success: true;
  data: T;
}

/**
 * LoginPage — public auth route for the seller dashboard.
 *
 * Hits the existing `/auth/login` endpoint and enforces role gating
 * client-side: only `seller` or `admin` accounts may proceed into the
 * dashboard. Buyers get bounced back to the storefront.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = searchParams.get('redirect') ?? '/';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      const { data } = await apiClient.post<
        ApiSuccess<{ accessToken: string; user: UserPublic }>
      >('/auth/login', values);

      const { accessToken, user } = data.data;

      // Role gating — buyers don't belong inside the seller dashboard.
      if (user.role !== 'seller' && user.role !== 'admin') {
        toast.error(
          'This portal is for sellers only. Please sign in via the storefront.',
        );
        setIsSubmitting(false);
        return;
      }

      setAuth(user, accessToken);
      toast.success(`Welcome, ${user.fullName.split(' ')[0]}!`);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const message =
        isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : 'Invalid email or password';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <span className="w-10 h-10 rounded-lg bg-[#002b5b] text-white flex items-center justify-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M3 9l1-5h16l1 5" />
              <path d="M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
              <path d="M9 13h6" />
            </svg>
          </span>
          <span className="text-xl font-bold text-slate-900">Seller Hub</span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900">
              Sign in to your seller account
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Manage your storefront, products, and orders.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register('email')}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#002b5b] focus:outline-none focus:ring-2 focus:ring-[#002b5b]/20 transition-colors"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register('password')}
                placeholder="Enter your password"
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#002b5b] focus:outline-none focus:ring-2 focus:ring-[#002b5b]/20 transition-colors"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-[#002b5b] focus:ring-[#002b5b]/20"
                />
                Remember me
              </label>
              <Link
                to="/forgot-password"
                className="text-sm text-[#002b5b] hover:underline font-medium"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center rounded-lg bg-[#002b5b] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#001f3f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have a seller account?{' '}
          <Link
            to="/register"
            className="text-[#002b5b] hover:underline font-medium"
          >
            Apply to become a seller
          </Link>
        </p>
      </div>
    </div>
  );
}
