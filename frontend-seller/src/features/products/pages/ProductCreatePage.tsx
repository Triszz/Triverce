import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  GripVertical,
  ImagePlus,
  Loader2,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useCategories, useCreateProduct } from '../hooks/useProducts';
import type { Category } from '../services/productService';
import {
  IMAGE_VALIDATION_HELPER_TEXT,
  validateImageFile,
} from '@/lib/imageValidation';

const productFormSchema = z.object({
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .max(255, 'Name must be at most 255 characters'),
  description: z
    .string()
    .max(5000, 'Description must be at most 5000 characters')
    .optional()
    .or(z.literal('')),
  basePrice: z
    .number({ error: 'Base price is required' })
    .int('Price must be a whole number (VND)')
    .min(1000, 'Minimum price is 1,000 ₫'),
  categoryId: z.string().optional().or(z.literal('')),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

/**
 * ProductCreatePage — minimal create form for the seller dashboard.
 *
 * Fields match the spec: name / description / basePrice / categoryId /
 * image. Images are uploaded via `/api/upload/products/:productId`
 * after the product is created (the backend requires a productId for
 * the upload path), so the dashboard stages files locally until
 * submission commits them through the multi-image API.
 */
export function ProductCreatePage() {
  const navigate = useNavigate();
  const { data: categories, isLoading: isLoadingCategories } = useCategories();
  const createMutation = useCreateProduct();

  type StagedFile = {
    id: string;
    file: File;
    previewUrl: string;
  };
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [stagedError, setStagedError] = useState<string | null>(null);

  // Revoke any staged blob URLs on unmount so we don't leak across
  // navigations. Created inside this component, owned by us.
  const urlsToRevokeRef = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const url of urlsToRevokeRef.current) URL.revokeObjectURL(url);
    },
    [],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: '',
      description: '',
      basePrice: 0,
      categoryId: '',
    },
  });

  const sortedCategories = useMemo(() => {
    if (!categories) return [];
    return [...categories]
      .filter((c: Category) => c.isActive)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [categories]);

  const onSubmit = async (values: ProductFormValues) => {
    try {
      const dto = {
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        basePrice: values.basePrice,
        categoryId: values.categoryId || undefined,
        isActive: true,
      };

      await createMutation.mutateAsync({
        dto,
        images: stagedFiles.map((s) => s.file),
      });
      navigate('/products', { replace: true });
    } catch {
      // toast handled in mutation's onError
    }
  };

  const handleStageFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    setStagedError(null);
    const list = Array.from(event.target.files ?? []);
    if (list.length === 0) return;

    const remaining = 10 - stagedFiles.length;
    const next: StagedFile[] = [];
    for (const file of list) {
      if (next.length >= remaining) break;
      // Strict whitelist — must be JPEG/PNG/WebP AND under 5 MB.
      // Surfaced as a toast (the dashboard's canonical error sink) and
      // as the inline `stagedError` for the persistent hint area.
      const reason = validateImageFile(file);
      if (reason) {
        setStagedError(reason);
        toast.error(reason);
        continue;
      }
      const url = URL.createObjectURL(file);
      urlsToRevokeRef.current.push(url);
      next.push({
        id: `${file.name}-${file.lastModified}-${next.length}`,
        file,
        previewUrl: url,
      });
    }
    setStagedFiles((prev) => [...prev, ...next]);
    event.target.value = '';
  };

  const removeStaged = (id: string) =>
    setStagedFiles((prev) => prev.filter((s) => s.id !== id));

  const clearStaged = () => {
    setStagedFiles([]);
    setStagedError(null);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Link
          to="/products"
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          aria-label="Back to products"
        >
          <ArrowLeft size={18} aria-hidden />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Create product</h1>
          <p className="mt-1 text-sm text-slate-500">
            Add a new item to your storefront catalog.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6"
      >
        {/* Name */}
        <Field
          label="Product name"
          htmlFor="name"
          error={errors.name?.message}
          required
        >
          <input
            id="name"
            type="text"
            placeholder="e.g. Classic white t-shirt"
            className={inputClass(Boolean(errors.name?.message))}
            {...register('name')}
          />
        </Field>

        {/* Description */}
        <Field
          label="Description"
          htmlFor="description"
          error={errors.description?.message}
          hint="Optional. Up to 5,000 characters."
        >
          <textarea
            id="description"
            rows={4}
            placeholder="Tell shoppers what makes this product great…"
            className={`${inputClass(Boolean(errors.description?.message))} resize-y`}
            {...register('description')}
          />
        </Field>

        {/* Base price + Category (side-by-side on sm+) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Field
            label="Base price (₫)"
            htmlFor="basePrice"
            error={errors.basePrice?.message}
            required
          >
            <input
              id="basePrice"
              type="number"
              min={1000}
              step={1000}
              placeholder="100000"
              className={inputClass(Boolean(errors.basePrice?.message))}
              {...register('basePrice', { valueAsNumber: true })}
            />
          </Field>

          <Field
            label="Category"
            htmlFor="categoryId"
            error={errors.categoryId?.message}
            hint={
              isLoadingCategories ? 'Loading categories…' : 'Optional'
            }
          >
            <select
              id="categoryId"
              className={inputClass(Boolean(errors.categoryId?.message))}
              {...register('categoryId')}
            >
              <option value="">— Select a category —</option>
              {sortedCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Image gallery (create) — only staged tiles; no server images
            exist yet for a brand-new product. */}
        <Field
          label="Product gallery"
          htmlFor="create-images-add"
          error={stagedError ?? undefined}
          hint="Up to 10 images. The first one becomes the storefront thumbnail."
        >
          {stagedFiles.length === 0 ? (
            <label
              htmlFor="create-images-add"
              className="flex flex-col items-center justify-center w-full h-40 rounded-lg border-2 border-dashed border-slate-300 hover:border-[#002b5b] hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <ImagePlus size={22} className="text-slate-400 mb-2" aria-hidden />
              <span className="text-sm font-medium text-slate-700">
                Click to upload images
              </span>
              <span className="text-xs text-slate-500 mt-1">
                {IMAGE_VALIDATION_HELPER_TEXT}
              </span>
              <input
                id="create-images-add"
                type="file"
                accept="image/*"
                multiple
                onChange={handleStageFiles}
                className="sr-only"
              />
            </label>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {stagedFiles.map((staged, index) => (
                  <div
                    key={staged.id}
                    className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-50 group"
                  >
                    <img
                      src={staged.previewUrl}
                      alt={staged.file.name}
                      className="w-full h-full object-cover"
                    />
                    {index === 0 && (
                      <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#002b5b] text-white text-[11px] font-medium shadow">
                        <Star size={11} aria-hidden /> Ảnh đại diện
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeStaged(staged.id)}
                      aria-label="Remove staged image"
                      className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-white/90 text-slate-500 hover:bg-red-50 hover:text-red-600 shadow cursor-pointer"
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                    <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[11px] truncate max-w-[80%]">
                      {staged.file.name}
                    </span>
                    {index > 0 && (
                      <span
                        className={cn(
                          'absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500 text-white text-[11px] font-medium shadow',
                        )}
                        title={`Will become image #${index + 1}`}
                      >
                        <GripVertical size={11} aria-hidden /> #{index + 1}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <label
                  htmlFor="create-images-add-more"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <ImagePlus size={16} aria-hidden />
                  Add more images
                  <input
                    id="create-images-add-more"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleStageFiles}
                    className="sr-only"
                  />
                </label>
                <button
                  type="button"
                  onClick={clearStaged}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X size={14} aria-hidden /> Clear all
                </button>
                <span className="text-xs text-slate-500">
                  {stagedFiles.length}/10 staged · {IMAGE_VALIDATION_HELPER_TEXT}
                </span>
              </div>
            </>
          )}
        </Field>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Link
            to="/products"
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || createMutation.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#002b5b] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#001f3f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {(isSubmitting || createMutation.isPending) ? (
              <>
                <Loader2 size={14} className="animate-spin" aria-hidden /> Creating…
              </>
            ) : 'Create product'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Local presentational helpers
 * ────────────────────────────────────────────────────────────────────────── */

function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-slate-700 mb-1.5"
      >
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      )}
      {error && (
        <p className="mt-1.5 text-xs text-red-600 font-medium">{error}</p>
      )}
    </div>
  );
}

function inputClass(hasError: boolean): string {
  return [
    'w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900',
    'placeholder:text-slate-400 shadow-sm transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-[#002b5b]/20 focus:border-[#002b5b]',
    hasError
      ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
      : 'border-slate-200',
  ].join(' ');
}