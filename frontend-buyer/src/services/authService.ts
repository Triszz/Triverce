import apiClient from './apiClient';

// ── Shared types (mirrors backend UserEntity.toPublic()) ──────────────────────
export interface UserPublic {
  id: string;
  email: string;
  fullName: string;
  role: 'customer' | 'admin' | 'seller';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  role?: 'customer' | 'seller' | 'admin';
}

export interface LoginPayload {
  email: string;
  password: string;
}

/** Payload accepted by `PATCH /auth/me/profile` (mirrors backend `UpdateProfileDto`). */
export interface UpdateProfilePayload {
  fullName: string;
}

/** Payload accepted by `PATCH /auth/me/password` (mirrors backend `ChangePasswordDto`). */
export interface ChangePasswordPayload {
  oldPassword: string;
  newPassword: string;
}

// ── API response envelopes (mirrors backend controller responses) ────────────
interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  message: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ── Auth service ────────────────────────────────────────────────────────────

export const authService = {
  /**
   * POST /auth/register
   * Backend: 201 { success: true, data: UserPublic }
   */
  register: async (payload: RegisterPayload): Promise<UserPublic> => {
    const { data } = await apiClient.post<
      ApiSuccess<UserPublic>
    >('/auth/register', payload);

    if (!data.success) throw new Error('Registration failed');

    return data.data;
  },

  /**
   * POST /auth/login
   * Backend: 200 { success: true, data: { accessToken, user } }
   * The refreshToken arrives as an httpOnly cookie and is handled by the
   * apiClient's response interceptor automatically.
   */
  login: async (
    payload: LoginPayload,
  ): Promise<{ accessToken: string; user: UserPublic }> => {
    const { data } = await apiClient.post<
      ApiSuccess<{ accessToken: string; user: UserPublic }>
    >('/auth/login', payload);

    if (!data.success) throw new Error('Login failed');

    return data.data;
  },

  /**
   * POST /auth/refresh
   * Backend: 200 { success: true, data: { accessToken } }
   * Handled automatically by apiClient on 401; exposed here for callers who
   * need manual refresh control.
   */
  refresh: async (): Promise<string> => {
    const { data } = await apiClient.post<
      ApiSuccess<{ accessToken: string }>
    >('/auth/refresh', {});

    if (!data.success) throw new Error('Token refresh failed');

    return data.data.accessToken;
  },

  /**
   * POST /auth/logout
   * Backend: 200 { success: true, message: "Logged out successfully!" }
   */
  logout: async (): Promise<void> => {
    await apiClient.post<ApiSuccess<{ message: string }>>(
      '/auth/logout',
      {},
    );
  },

  /**
   * PATCH /auth/me/profile
   * Backend: 200 { success: true, data: UserPublic }
   *
   * Returns the freshly-updated user — the caller is expected to push
   * that object back into `useAuthStore` so the Header / AccountPage
   * (and any other consumer) reflect the new name without a refresh.
   */
  updateProfile: async (
    payload: UpdateProfilePayload,
  ): Promise<UserPublic> => {
    const { data } = await apiClient.patch<
      ApiSuccess<UserPublic>
    >('/auth/me/profile', payload);
    if (!data.success) throw new Error('Profile update failed');
    return data.data;
  },

  /**
   * PATCH /auth/me/password
   * Backend: 200 { success: true, message: "Password updated successfully" }
   *
   * Returns void — there is no new data to surface on a successful
   * password change. The 401 path is meaningful: it means the
   * `oldPassword` was wrong, so the caller should keep the user on the
   * form and surface a toast.
   */
  changePassword: async (
    payload: ChangePasswordPayload,
  ): Promise<void> => {
    const { data } = await apiClient.patch<
      ApiSuccess<{ message: string }>
    >('/auth/me/password', payload);
    if (!data.success) throw new Error('Password change failed');
  },
};
