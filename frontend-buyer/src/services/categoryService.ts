import apiClient from './apiClient';
import type {
  ApiPaginatedResponse,
  ApiResponse,
} from '@/types/api';

/**
 * Public category shape — mirrors backend `CategoryEntity.toPublic()`.
 */
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryListParams {
  page?: number;
  limit?: number;
  parentId?: string;
  isActive?: boolean;
}

/**
 * Category service — thin wrapper around `/api/categories`.
 *
 * Auth: not required for read endpoints; admin role required for writes
 * (those endpoints are out of scope for the buyer frontend).
 */
export const categoryService = {
  /**
   * GET /categories — paginated list.
   */
  list: async (
    params: CategoryListParams = {},
  ): Promise<{ data: Category[]; total: number; page: number; limit: number }> => {
    const { data } = await apiClient.get<ApiPaginatedResponse<Category>>(
      '/categories',
      { params },
    );
    if (!data.success) throw new Error('Failed to load categories');
    return {
      data: data.data,
      total: data.meta.total,
      page: data.meta.page,
      limit: data.meta.limit,
    };
  },

  /**
   * GET /categories/:id — single category by UUID.
   */
  getById: async (id: string): Promise<Category> => {
    const { data } = await apiClient.get<ApiResponse<Category>>(
      `/categories/${id}`,
    );
    if (!data.success) throw new Error('Category not found');
    return data.data;
  },

  /**
   * GET /categories/slug/:slug — single category by slug.
   */
  getBySlug: async (slug: string): Promise<Category> => {
    const { data } = await apiClient.get<ApiResponse<Category>>(
      `/categories/slug/${slug}`,
    );
    if (!data.success) throw new Error('Category not found');
    return data.data;
  },
};