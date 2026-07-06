/**
 * Shared API envelope types.
 *
 * Backend controllers uniformly respond with either:
 *   { success: true,  data: T, meta optional }   // collection endpoint
 *   { success: true,  data: T }                  // single-resource endpoint
 *   { success: false, message: string }          // error
 *
 * Keep these types aligned with the backend controllers.
 */

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiSuccessWithMeta<T> {
  success: true;
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface ApiError {
  success: false;
  message: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
export type ApiPaginatedResponse<T> = ApiSuccessWithMeta<T> | ApiError;