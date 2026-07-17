import { useEffect, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ImageIcon, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatVnd } from '@/lib/format';
import { toast } from 'sonner';
import type { ProductVariant } from '../services/productService';
import {
  IMAGE_VALIDATION_HELPER_TEXT,
  validateImageFile,
} from '@/lib/imageValidation';

/* ──────────────────────────────────────────────────────────────────────────
 * Form schema — matches what's needed for the seller UI, not a verbatim
 * copy of the backend DTO. The backend DTO is stricter (sku must be
 * globally unique, attributes must be record<string,string>), but we
 * translate here so a missing field gives a useful inline message.
 * ────────────────────────────────────────────────────────────────────────── */

const attributePairSchema = z.object({
  name: z.string().min(1, 'Required').max(40),
  value: z.string().min(1, 'Required').max(80),
});

const variantFormSchema = z.object({
  sku: z
    .string()
    .min(1, 'SKU is required')
    .max(100, 'SKU is too long')
    .trim(),
  price: z
    .number({ error: 'Price is required' })
    .int('Price must be a whole number (VND)')
    .min(1000, 'Minimum price is 1,000 ₫'),
  isActive: z.boolean(),
  attributes: z.array(attributePairSchema),
});

export type VariantFormValues = z.infer<typeof variantFormSchema>;

interface VariantFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Existing variant being edited, or `null` when adding a new one. */
  variant: ProductVariant | null;
  /**
   * Product this variant belongs to. Required so the modal can call
   * `useUploadVariantImage(productId)` directly while editing, and so
   * the parent can orchestrate create-then-upload for new variants.
   */
  productId: string;
  /**
   * Pre-filled base price (when creating a new variant). The form uses
   * this as a sensible default so the seller only overrides when needed.
   */
  defaultPrice?: number;
  /**
   * Submit handler — receives the normalized payload + the merged
   * attribute map + the staged image file (if any, only relevant for
   * the new-variant flow).
   */
  onSubmit: (
    values: VariantFormValues,
    attributes: Record<string, string>,
    image: File | null,
  ) => void;
  isSubmitting?: boolean;
}

/**
 * VariantFormModal — add/edit a variant.
 *
 * Why "name" comes from `attributes`: the backend schema doesn't store a
 * variant "name" — a variant is identified by its `attributes`
 * (e.g., `{ color: "Red", size: "M" }`). For UX parity with the spec
 * ("name like 'Red - Size M'") we render an attributes grid and join
 * the values as the human-readable label.
 *
 * Image handling (staged, not auto-uploaded):
 *   • Picking a file in this modal stages it locally via
 *     `URL.createObjectURL` — the preview updates immediately.
 *   • The staged file is handed back to the parent via `onSubmit`. The
 *     parent decides when to actually upload (immediately after the
 *     create / update succeeds) — keeping a single commit point that
 *     mirrors every other field.
 *   • For new variants, the create must succeed before we can upload
 *     (we need the variant id); for existing variants, uploading is
 *     tied to "Save changes" instead of fire-and-forget.
 */
export function VariantFormModal({
  open,
  onClose,
  variant,
  productId,
  defaultPrice,
  onSubmit,
  isSubmitting,
}: VariantFormModalProps) {
  const isEditing = variant !== null;
  // `productId` is kept on the props contract for future use (e.g. the
  // dashboard might want to bind preview images to other variants on the
  // same product). The modal itself only stages — it does not upload.
  void productId;

  // A stable "session" key: changes when the modal opens or the target
  // variant changes. We use it to remount controlled state via lazy
  // initializers (avoids the `setState inside useEffect` lint pattern
  // without losing the ability to reset between edits).
  const sessionKey = `${open ? 'open' : 'closed'}-${variant?.id ?? 'new'}`;

  // Build the full default values including the real attributes array.
  // IMPORTANT: `defaultValues.attributes` must match what `fields` will
  // render, or RHF's native `isDirty` will be `true` on mount because
  // `defaultValues` (e.g. `[]`) differs from the initial field values.
  const defaultValues: VariantFormValues = (() => {
    if (variant) {
      const attrs = (variant.attributes ?? []).map((a) => ({
        name: a.attributeName,
        value: a.value,
      }));
      return {
        sku: variant.sku,
        price: variant.price,
        isActive: variant.isActive,
        attributes: attrs.length > 0 ? attrs : [emptyAttribute()],
      };
    }
    return {
      sku: '',
      price: defaultPrice ?? 0,
      isActive: true,
      attributes: [emptyAttribute()],
    };
  })();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty },
    getValues,
  } = useForm<VariantFormValues>({
    resolver: zodResolver(variantFormSchema),
    defaultValues,
  });

  // useFieldArray gives RHF full awareness of the attributes array, so
  // `isDirty` tracks attribute changes automatically — no manual comparison.
  const {
    fields: attributeFields,
    append,
    remove,
  } = useFieldArray({ control, name: 'attributes' });

  const [currentSession, setCurrentSession] = useState(sessionKey);

  // Staged image state — held locally until the seller commits via
  // "Add variant" / "Save changes". The blob URL is built once on stage
  // and revoked on unmount, so we don't leak refs across re-renders.
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  // Holds every blob URL we ever created in this modal lifetime so we
  // can revoke them all on unmount. We accumulate rather than sync on
  // every render to avoid ref writes during render.
  const urlsToRevokeRef = useRef<string[]>([]);

  // Revoke every staged blob URL when the modal unmounts. We own the
  // URLs (created via URL.createObjectURL inside this component), so we
  // own the cleanup.
  useEffect(() => {
    return () => {
      for (const url of urlsToRevokeRef.current) {
        URL.revokeObjectURL(url);
      }
      urlsToRevokeRef.current = [];
    };
  }, []);

  // When the modal opens (or the target variant changes), realign state
  // by re-keying — causing the controlled effects below to run cleanly.
  if (currentSession !== sessionKey) {
    setCurrentSession(sessionKey);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImageFile(null);
    setPreviewUrl(null);
    setImageError(null);
    reset(defaultValues);
  }

  const handleAddAttribute = () => append(emptyAttribute());

  const handleRemoveAttribute = (idx: number) => {
    if (attributeFields.length <= 1) return;
    remove(idx);
  };

  // Close on Escape — ref to a stable wrapper so we can detach cleanly.
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleFormSubmit = (values: VariantFormValues) => {
    const attrs: Record<string, string> = {};
    for (const p of values.attributes) {
      const key = p.name.toLowerCase().trim();
      if (!key) continue;
      attrs[key] = p.value.trim();
    }
    // Hand the staged file back to the parent for ALL variants (new or
    // existing). The parent orchestrates the actual upload after the
    // create/update succeeds — keeps the commit point atomic and means
    // the modal doesn't fire HTTP requests in `onChange`.
    onSubmit(values, attrs, imageFile);
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setImageError(null);
    if (!file) {
      // "Cancel" on the file dialog — leave whatever was already staged.
      return;
    }
    // Shared validator: must be JPEG/PNG/WebP and under 5 MB. On
    // failure, both the inline error AND a toast surface so the seller
    // gets feedback even if they miss the inline message.
    const reason = validateImageFile(file);
    if (reason) {
      setImageError(reason);
      toast.error(reason);
      // Reset native input so picking the same (now-rejected) file
      // still triggers onChange on retry.
      event.target.value = '';
      return;
    }

    // Replace any previously staged file. We revoke the previous URL
    // eagerly because the new URL is the only one we need going forward.
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(file);
    urlsToRevokeRef.current.push(url);
    setImageFile(file);
    setPreviewUrl(url);
    // Allow re-selecting the same file twice (needed for the "choose a
    // different image" affordance to feel responsive).
    event.target.value = '';
  };

  const clearImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImageFile(null);
    setPreviewUrl(null);
    setImageError(null);
  };

  // Live price from RHF for the header preview.
  const currentPrice = useWatch({ control, name: 'price' });

  // Derived display name from RHF's field values (not local state).
  const computedDisplayName = useWatch({
    control,
    name: 'attributes',
  });
  const displayName = computedDisplayName
    ?.map((a) => a.value)
    .filter(Boolean)
    .join(' • ') || '—';

  // Unified dirty flag: RHF's `isDirty` covers all registered form fields
  // (sku, price, isActive, attributes via useFieldArray). The only
  // untracked piece is the locally-staged image file — check it separately.
  const isFormModified = isDirty || imageFile !== null;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-xl bg-white rounded-xl shadow-xl border border-slate-200 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {isEditing ? 'Edit variant' : 'Add variant'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Preview: <span className="font-medium text-slate-700">{displayName}</span>
              {' • '}
              {Number.isFinite(currentPrice) && currentPrice > 0
                ? formatVnd(currentPrice)
                : 'Set a price'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* Scrollable body */}
        <form
          id="variant-form"
          onSubmit={handleSubmit(handleFormSubmit)}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
        >
          {/* SKU + Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="sku"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                SKU <span className="text-red-500">*</span>
              </label>
              <input
                id="sku"
                type="text"
                placeholder="e.g. TSHIRT-RED-M"
                className={inputClass(Boolean(errors.sku?.message))}
                {...register('sku')}
              />
              {errors.sku?.message && (
                <p className="mt-1.5 text-xs text-red-600">{errors.sku.message}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="price"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Price (₫) <span className="text-red-500">*</span>
              </label>
              <input
                id="price"
                type="number"
                min={1000}
                step={1000}
                placeholder="100000"
                className={inputClass(Boolean(errors.price?.message))}
                {...register('price', { valueAsNumber: true })}
              />
              {errors.price?.message && (
                <p className="mt-1.5 text-xs text-red-600">{errors.price.message}</p>
              )}
            </div>
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-slate-300 text-[#002b5b] focus:ring-[#002b5b]/20"
              {...register('isActive')}
            />
            <span>Available for sale</span>
          </label>

          {/* Image */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Variant image
            </label>
            <div className="flex items-start gap-4">
              <div className="w-24 h-24 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 shrink-0 flex items-center justify-center">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="New image preview"
                    className="w-full h-full object-cover"
                  />
                ) : variant?.imageUrl ? (
                  <img
                    src={variant.imageUrl}
                    alt={variant.sku}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon size={24} className="text-slate-300" aria-hidden />
                )}
              </div>
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <label
                  htmlFor="variant-image"
                  className="inline-flex items-center justify-center gap-2 w-fit px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <ImagePlus size={14} aria-hidden />
                  {imageFile
                    ? 'Choose a different image'
                    : variant?.imageUrl
                      ? 'Replace image'
                      : 'Choose image'}
                  <input
                    id="variant-image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageChange}
                    className="sr-only"
                  />
                </label>

                <span className="text-[11px] text-slate-500">
                  {IMAGE_VALIDATION_HELPER_TEXT}
                </span>

                {imageFile && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                    {isEditing ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden />
                        Will replace the current image on save
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden />
                        Will upload after the variant is created
                      </>
                    )}
                  </span>
                )}

                {imageError && (
                  <p className="text-xs text-red-600 font-medium">{imageError}</p>
                )}

                {imageFile && (
                  <button
                    type="button"
                    onClick={clearImage}
                    className="inline-flex items-center gap-1 w-fit text-xs font-medium text-slate-600 hover:text-red-600 cursor-pointer"
                  >
                    <X size={12} aria-hidden /> Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Attributes — fully managed by useFieldArray */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700">
                Attributes
              </label>
              <button
                type="button"
                onClick={handleAddAttribute}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#002b5b] hover:text-[#001f3f]"
              >
                <Plus size={14} aria-hidden /> Add attribute
              </button>
            </div>

            <div className="space-y-2">
              {attributeFields.map((field, idx) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                  <input
                    type="text"
                    placeholder="Name (e.g. color)"
                    {...register(`attributes.${idx}.name` as const)}
                    className={cn(inputClass(Boolean(errors.attributes?.[idx]?.name?.message)), 'col-span-5')}
                    aria-label="Attribute name"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. Red)"
                    {...register(`attributes.${idx}.value` as const)}
                    className={cn(inputClass(Boolean(errors.attributes?.[idx]?.value?.message)), 'col-span-6')}
                    aria-label="Attribute value"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveAttribute(idx)}
                    disabled={attributeFields.length <= 1}
                    className="col-span-1 p-2.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Remove attribute"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              Attributes describe this variant (e.g. color, size, storage).
              Together they form the customer-facing variant name.
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 shrink-0 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="variant-form"
            disabled={!isFormModified || isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#002b5b] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#001f3f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
          >
            {isSubmitting
              ? 'Saving…'
              : isEditing
                ? 'Save changes'
                : 'Add variant'}
          </button>
        </div>
      </div>
    </div>
  );
}

function emptyAttribute() {
  return { name: '', value: '' };
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
