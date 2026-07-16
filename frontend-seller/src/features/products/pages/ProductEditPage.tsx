import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  BoxIcon,
  Edit,
  GripVertical,
  ImageIcon,
  ImageOff,
  ImagePlus,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  Star,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatVnd } from "@/lib/format";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "sonner";
import { toAbsoluteUrl } from "@/lib/url";
import {
  IMAGE_VALIDATION_HELPER_TEXT,
  validateImageFile,
} from "@/lib/imageValidation";
import {
  useCategories,
  useCreateVariant,
  useDeleteVariant,
  useProduct,
  useSetProductImages,
  useSetVariantInventory,
  useUpdateProduct,
  useUpdateVariant,
  useUploadProductImages,
  useUploadVariantImage,
} from "../hooks/useProducts";
import type {
  Category,
  Product,
  ProductVariant,
} from "../services/productService";
import { variantDisplayName } from "../services/productService";
import { VariantFormModal, type VariantFormValues } from "./VariantFormModal";

type Tab = "basic" | "variants";

/* ──────────────────────────────────────────────────────────────────────────
 * Basic-info form schema. Mirrors ProductCreatePage.
 * ────────────────────────────────────────────────────────────────────────── */

const basicFormSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(255, "Name must be at most 255 characters"),
  description: z
    .string()
    .max(5000, "Description must be at most 5,000 characters")
    .optional()
    .or(z.literal("")),
  basePrice: z
    .number({ error: "Base price is required" })
    .int("Price must be a whole number (VND)")
    .min(1000, "Minimum price is 1,000 ₫"),
  categoryId: z.string().optional().or(z.literal("")),
  isActive: z.boolean(),
});

type BasicFormValues = z.infer<typeof basicFormSchema>;

/**
 * ProductEditPage — `/products/:id/edit`.
 *
 * Two tabs/cards:
 *  1. **Basic Info** — name/description/price/category/active flag.
 *  2. **Variants** — list, per-row inventory + edit, add, delete.
 *
 * Loading state is a skeleton card; error state offers retry. We never
 * re-derive the form from scratch on cache invalidations to avoid
 * wiping in-progress edits.
 */
export function ProductEditPage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const productId = params.id ?? "";
  const [tab, setTab] = useState<Tab>("basic");

  const {
    data: product,
    isLoading,
    isError,
    error,
    refetch,
  } = useProduct(productId);

  if (isLoading) return <PageSkeleton />;
  if (isError || !product) {
    return (
      <ErrorState
        message={(error as Error)?.message ?? "Product not found"}
        onRetry={() => void refetch()}
        onBack={() => navigate("/products")}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link
          to="/products"
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
          aria-label="Back to products"
        >
          <ArrowLeft size={18} aria-hidden />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 truncate">
            {product.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            <span className="font-mono text-xs">{product.slug}</span>
            <span className="mx-2">•</span>
            {product.variants?.length ?? 0} variant
            {(product.variants?.length ?? 0) === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
          <TabButton
            active={tab === "basic"}
            onClick={() => setTab("basic")}
            icon={Package}
            label="Basic info"
          />
          <TabButton
            active={tab === "variants"}
            onClick={() => setTab("variants")}
            icon={BoxIcon}
            label="Variants"
          />
        </nav>
      </div>

      {/* Both panels are mounted so that local state in `BasicInfoSection`
          (e.g. staged image files) survives tab toggles. CSS toggles
          visibility — the panel layer doesn't unmount when the user
          switches tabs. The `aria-hidden` mirrors the visual state. */}
      <div
        className={tab === "basic" ? "block" : "hidden"}
        aria-hidden={tab !== "basic"}
      >
        <BasicInfoSection product={product} />
      </div>
      <div
        className={tab === "variants" ? "block" : "hidden"}
        aria-hidden={tab !== "variants"}
      >
        <VariantsSection product={product} />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Basic info card
 * ────────────────────────────────────────────────────────────────────────── */

function BasicInfoSection({ product }: { product: Product }) {
  const { data: categories, isLoading: isLoadingCategories } = useCategories();
  const updateMutation = useUpdateProduct(product.id);
  const uploadImages = useUploadProductImages(product.id);
  const setImages = useSetProductImages(product.id);

  // Staged files live locally; they only commit via the "Save gallery"
  // action. Using a list (not single) keeps the multi-select
  // affordance cheap and lets us render a real preview grid.
  type StagedFile = {
    id: string;
    file: File;
    previewUrl: string;
  };
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [stagedError, setStagedError] = useState<string | null>(null);

  // Server-truth images the user wants to *keep*. We don't mutate the
  // server on every delete — instead we maintain a local list and
  // persist the final array on "Save gallery". This mirrors how the
  // form fields work and gives the seller a single "commit" point.
  // We seed this from `product.images` and re-seed whenever the slug
  // (product.id) changes — see the effect below.
  const [retainedImages, setRetainedImages] = useState<string[]>(
    () => product.images ?? [],
  );

  // Re-seed `retainedImages` in two cases:
  //
  //   1. The seller navigates to a different product (product.id
  //      changes) — the section doesn't remount, so we explicitly
  //      re-seed here.
  //
  //   2. React Query delivers new server data for the *same* product
  //      (the `images` array reference changes). This happens after
  //      `useSetProductImages.onSuccess` invalidates the cache and the
  //      refetch completes. Without this branch, the local
  //      `retainedImages` would lag the server until a hard page
  //      refresh. `handleSaveGallery` already calls
  //      `setRetainedImages(finalImages)` proactively, but other
  //      flows (e.g. variant flow that also invalidates) benefit from
  //      this sync too.
  //
  // The ref comparisons during render are intentional — using a
  // `useEffect` here would cause a flash of the previous gallery on
  // every cache refresh.
  const seededProductIdRef = useRef<string | null>(null);
  const seededImagesRef = useRef<string[] | null>(null);
  // eslint-disable-next-line react-hooks/refs
  if (seededProductIdRef.current !== product.id) {
    const next = product.images ?? [];
    // eslint-disable-next-line react-hooks/refs
    seededProductIdRef.current = product.id;
    // eslint-disable-next-line react-hooks/refs
    seededImagesRef.current = next;
    setRetainedImages(next);
  } else {
    const next = product.images ?? [];
    if (seededImagesRef.current !== next) {
      // eslint-disable-next-line react-hooks/refs
      seededImagesRef.current = next;
      setRetainedImages(next);
    }
  }

  // Clean up object URLs whenever a file leaves the staged list — leaks
  // happen quickly otherwise (each <img preview> holds its blob).
  useEffect(() => {
    return () => {
      stagedFiles.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    };
    // Cleanup runs only on unmount; we don't want it to fire on every
    // stagedFiles change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStageFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    setStagedError(null);
    const list = Array.from(event.target.files ?? []);
    if (list.length === 0) return;
    const maxExisting = 10 - retainedImages.length;
    const filtered: StagedFile[] = [];
    for (const file of list) {
      if (filtered.length >= maxExisting) break;
      // Strict whitelist — must be JPEG/PNG/WebP AND under 5 MB.
      // Surfaces a toast + the inline `stagedError`; nothing gets staged.
      const reason = validateImageFile(file);
      if (reason) {
        setStagedError(reason);
        toast.error(reason);
        continue;
      }
      filtered.push({
        id: `${file.name}-${file.lastModified}-${filtered.length}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
    setStagedFiles((prev) => [...prev, ...filtered]);
    // Reset native input so picking the same file twice still triggers onChange.
    event.target.value = "";
  };

  const removeStaged = (id: string) =>
    setStagedFiles((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((s) => s.id !== id);
    });

  const clearStaged = () => {
    stagedFiles.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    setStagedFiles([]);
    setStagedError(null);
  };

  // Drop a server image from the local "kept" list. Does not persist —
  // the seller commits the new array via "Save gallery" so deletions
  // and additions can be batched into a single round-trip.
  const removeRetained = (url: string) =>
    setRetainedImages((prev) => prev.filter((u) => u !== url));

  // Restore `retainedImages` to whatever the server currently has, and
  // discard any staged files. Used by the "Discard" button to let the
  // seller back out of pending changes.
  const discardGalleryChanges = () => {
    setRetainedImages(product.images ?? []);
    clearStaged();
  };

  // Whether the gallery differs from the server snapshot. Drives the
  // Save button's enabled state.
  const originalImages = product.images ?? [];
  const retainedChanged =
    retainedImages.length !== originalImages.length ||
    retainedImages.some((url, i) => url !== originalImages[i]);
  const isGalleryDirty = retainedChanged || stagedFiles.length > 0;

  // Single commit point for the gallery. We:
  //   1. Upload the staged files (gets back raw UploadResult rows).
  //   2. Project each result → URL string (defensive: accept either
  //      `url`, `absoluteUrl`, or `path` to insulate us from a future
  //      API shape change; bad rows are skipped so we never pass
  //      `{}` placeholders into the PUT).
  //   3. Send the final images[] = retained + new via PUT (wholesale
  //      replacement; this is the only path that mutates
  //      `Product.images` — see backend `upload.controller.ts`).
  // Errors from either step are surfaced by the hooks themselves, so
  // local state stays intact and the seller can retry.
  const handleSaveGallery = async () => {
    if (!isGalleryDirty) return;
    try {
      let newUrls: string[] = [];
      if (stagedFiles.length > 0) {
        const result = await uploadImages.mutateAsync(
          stagedFiles.map((s) => s.file),
        );
        const rows = Array.isArray(result?.images) ? result.images : [];
        newUrls = rows
          .map((u) => {
            if (typeof u === "string") return u;
            if (u && typeof u === "object") {
              const candidate =
                (u as Record<string, unknown>).absoluteUrl ??
                (u as Record<string, unknown>).url ??
                (u as Record<string, unknown>).path;
              return typeof candidate === "string" ? candidate : null;
            }
            return null;
          })
          .filter((u): u is string => Boolean(u));
      }
      const finalImages = [...retainedImages, ...newUrls];
      // Defensive gate: reject any corrupt value before it reaches the
      // backend. If any URL is not a non-empty string, abort and let the
      // catch block surface the error so the seller sees a toast and the
      // DB is never corrupted with a bad value.
      const badUrl = finalImages.find(
        (img) =>
          typeof img !== "string" || img.trim() === "" || img === "undefined",
      );
      if (badUrl !== undefined) {
        throw new Error(
          `Corrupt image value detected before save: ${JSON.stringify(badUrl)}`,
        );
      }
      if (
        finalImages.length !== originalImages.length ||
        finalImages.some((u, i) => u !== originalImages[i])
      ) {
        await setImages.mutateAsync(finalImages);
      }
      // Backend now owns the full final array. We must explicitly
      // promote the staged uploads + retained set into the live
      // `retainedImages` slot — otherwise `clearStaged()` below removes
      // the new previews and the user sees the new images vanish
      // (the local state would otherwise only re-sync on a hard page
      // refresh, because the seed effect below uses a `product.id`
      // ref-guard and skips the re-seed for the same product id).
      setRetainedImages(finalImages);
      clearStaged();
      toast.success("Gallery updated successfully");
    } catch (err) {
      // Keep local state intact so the seller can retry without re-picking files.
      const msg =
        err instanceof Error ? err.message : "Failed to update gallery";
      toast.error(msg);
    }
  };

  const isGalleryBusy = uploadImages.isPending || setImages.isPending;

  const sortedCategories = useMemo<Category[]>(() => {
    if (!categories) return [];
    const selectedId = product.categoryId;
    // Always include the product's currently-selected category, even if it
    // is marked inactive — otherwise the <option> matching `defaultValues`
    // is missing and the <select> falls back to the placeholder, which
    // looks like a binding bug. Inactive categories we didn't select are
    // hidden from the dropdown.
    const activeList = [...categories].filter((c) => c.isActive);
    if (selectedId && !activeList.some((c) => c.id === selectedId)) {
      const selected = categories.find((c) => c.id === selectedId);
      if (selected) activeList.push(selected);
    }
    return activeList.sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );
  }, [categories, product.categoryId]);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isDirty },
    reset,
  } = useForm<BasicFormValues>({
    resolver: zodResolver(basicFormSchema),
    defaultValues: {
      name: product.name,
      description: product.description ?? "",
      basePrice: product.basePrice,
      categoryId: product.categoryId ?? "",
      isActive: product.isActive,
    },
  });

  // Re-seed form only when navigating to a different product. Updating
  // the same product in-place comes through `reset(undefined, { keepDirtyValues })`
  // is skipped so the user keeps their in-progress edits on re-render.
  useEffect(() => {
    reset({
      name: product.name,
      description: product.description ?? "",
      basePrice: product.basePrice,
      categoryId: product.categoryId ?? "",
      isActive: product.isActive,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  // Race-condition guard: when `categories` arrives (including on cold F5),
  // the <option> elements finally exist in the DOM. `register` already set
  // the form value correctly, but the browser dropped the visual selection
  // because the matching <option> wasn't there yet. Re-apply it now that
  // the options are populated.
  useEffect(() => {
    if (!categories) return;
    const current = getValues("categoryId");
    setValue("categoryId", current, { shouldDirty: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  const onSubmit = async (values: BasicFormValues) => {
    try {
      await updateMutation.mutateAsync({
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        basePrice: values.basePrice,
        categoryId: values.categoryId || null,
        isActive: values.isActive,
      });
    } catch {
      // toast handled in mutation
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6"
    >
      <Field
        label="Product name"
        htmlFor="name"
        error={errors.name?.message}
        required
      >
        <input
          id="name"
          type="text"
          className={inputClass(Boolean(errors.name?.message))}
          {...register("name")}
        />
      </Field>

      <Field
        label="Description"
        htmlFor="description"
        error={errors.description?.message}
        hint="Optional. Up to 5,000 characters."
      >
        <textarea
          id="description"
          rows={4}
          className={`${inputClass(Boolean(errors.description?.message))} resize-y`}
          {...register("description")}
        />
      </Field>

      <Field
        label="Product gallery"
        htmlFor="product-images-add"
        error={stagedError ?? undefined}
      >
        <ProductImageGallery
          retainedImages={retainedImages}
          stagedFiles={stagedFiles}
          isUploading={uploadImages.isPending}
          isPersisting={setImages.isPending}
          onRemoveRetained={removeRetained}
          onRemoveStaged={removeStaged}
        />

        {/* Top action row: all interactive controls in one horizontal line.
            Helper text moves to a separate row below so it doesn't squeeze
            the buttons or wrap unpredictably at narrow widths. */}
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          {/* Add images (file picker masquerading as a button). */}
          <label
            htmlFor="product-images-add"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 cursor-pointer transition-colors"
          >
            <ImagePlus size={16} aria-hidden />
            {stagedFiles.length > 0
              ? "Add more images"
              : retainedImages.length > 0
                ? "Add images"
                : "Choose images"}
            <input
              id="product-images-add"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleStageFiles}
              className="sr-only"
            />
          </label>

          {/* Unified commit point — uploads staged files and persists
              the final kept+new array in a single round-trip. Replaces
              the old "Upload now" button which used to fire-and-forget
              a separate upload mutation that didn't sync with deletes. */}
          <button
            type="button"
            onClick={() => void handleSaveGallery()}
            disabled={!isGalleryDirty || isGalleryBusy}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#002b5b] text-white text-sm font-medium hover:bg-[#001f3f] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isGalleryBusy ? (
              <>
                <Loader2 size={14} className="animate-spin" aria-hidden />
                Saving gallery…
              </>
            ) : (
              "Save gallery"
            )}
          </button>

          {isGalleryDirty && (
            <button
              type="button"
              onClick={discardGalleryChanges}
              disabled={isGalleryBusy}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X size={14} aria-hidden /> Discard changes
            </button>
          )}

          <span className="text-xs text-slate-500">
            {isGalleryDirty
              ? `${retainedImages.length + stagedFiles.length}/10 staged — click "Save gallery" to apply`
              : `${retainedImages.length}/10 images — gallery matches server`}
          </span>
        </div>

        {/* Helper text row — sits below the action row so it never
            competes with the buttons for horizontal space. */}
        <div className="flex flex-col gap-1 mt-3 text-sm text-slate-500">
          <span>
            Up to 10 images. The first image ({'"main"'}) appears as the
            thumbnail in listings and is used as the default in the storefront.
          </span>
          {/* Validation rules highlighted in red so the strict file
              constraints stand out — sellers should not miss them. */}
          <span className="text-red-500">{IMAGE_VALIDATION_HELPER_TEXT}</span>
        </div>
      </Field>

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
            className={inputClass(Boolean(errors.basePrice?.message))}
            {...register("basePrice", { valueAsNumber: true })}
          />
        </Field>

        <Field
          label="Category"
          htmlFor="categoryId"
          error={errors.categoryId?.message}
          hint={isLoadingCategories ? "Loading categories…" : "Optional"}
        >
          <select
            id="categoryId"
            className={inputClass(Boolean(errors.categoryId?.message))}
            disabled={isLoadingCategories}
            {...register("categoryId")}
          >
            <option value="">
              {isLoadingCategories ? "Loading categories…" : "— Select a category —"}
            </option>
            {sortedCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="w-4 h-4 rounded border-slate-300 text-[#002b5b] focus:ring-[#002b5b]/20"
          {...register("isActive")}
        />
        <span>Product is published (visible in storefront)</span>
      </label>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
        <Link
          to="/products"
          className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={!isDirty || updateMutation.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#002b5b] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#001f3f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
        >
          {updateMutation.isPending ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden /> Saving…
            </>
          ) : (
            "Save changes"
          )}
        </button>
      </div>
    </form>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Variants section
 * ────────────────────────────────────────────────────────────────────────── */

function VariantsSection({ product }: { product: Product }) {
  const navigate = useNavigate();
  const createVariant = useCreateVariant(product.id);
  const updateVariant = useUpdateVariant(product.id);
  const deleteVariant = useDeleteVariant(product.id);
  // Used after create-variant for the staged image picked in the modal.
  const uploadVariantImage = useUploadVariantImage(product.id);

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(
    null,
  );
  // Variant awaiting confirm — `null` when the dialog is closed.
  const [pendingDeleteVariant, setPendingDeleteVariant] =
    useState<ProductVariant | null>(null);

  const variants = useMemo(() => product.variants ?? [], [product.variants]);
  const filtered = useMemo(() => {
    if (!search.trim()) return variants;
    const term = search.toLowerCase();
    return variants.filter(
      (v) =>
        v.sku.toLowerCase().includes(term) ||
        variantDisplayName(v).toLowerCase().includes(term),
    );
  }, [variants, search]);

  const handleAdd = () => {
    setEditingVariant(null);
    setModalOpen(true);
  };

  const handleEdit = (variant: ProductVariant) => {
    setEditingVariant(variant);
    setModalOpen(true);
  };

  const requestDelete = (variant: ProductVariant) =>
    setPendingDeleteVariant(variant);
  const cancelDelete = () => setPendingDeleteVariant(null);

  const confirmDelete = async () => {
    if (!pendingDeleteVariant) return;
    try {
      await deleteVariant.mutateAsync(pendingDeleteVariant.id);
      setPendingDeleteVariant(null);
    } catch {
      // Surface the error then leave the dialog open so the user can
      // dismiss it intentionally rather than seeing the row vanish.
      setPendingDeleteVariant(null);
    }
  };

  const handleModalSubmit = async (
    values: VariantFormValues,
    attributes: Record<string, string>,
    stagedImage: File | null,
  ) => {
    // The modal now stages images in both create and edit flows; we
    // upload after the data write succeeds so all changes commit
    // together. `mutateAsync` is used so we can `await` and clean up
    // the modal state deterministically.
    try {
      if (editingVariant) {
        await updateVariant.mutateAsync({
          variantId: editingVariant.id,
          dto: {
            sku: values.sku,
            price: values.price,
            isActive: values.isActive,
            // Wholesale attribute replacement — the backend syncs
            // `variant_attribute_values` via deleteMany + create in a
            // single transaction. Skipping this previously caused
            // attribute edits to silently no-op (the DTO omitted
            // `attributes` and the repo never touched the join table).
            attributes,
          },
        });
        if (stagedImage) {
          try {
            await uploadVariantImage.mutateAsync({
              variantId: editingVariant.id,
              file: stagedImage,
            });
          } catch {
            // Variant data was saved; the image upload can be retried by
            // opening the modal again. Toast already surfaced.
          }
        }
        setModalOpen(false);
        return;
      }

      // New-variant flow: create first so we have a variantId, then
      // upload the staged image (if any). The upload hook itself PATCHes
      // the URL onto the variant row and invalidates the product cache.
      const created = await createVariant.mutateAsync({
        sku: values.sku,
        price: values.price,
        isActive: values.isActive,
        attributes,
      });
      if (stagedImage) {
        try {
          await uploadVariantImage.mutateAsync({
            variantId: created.id,
            file: stagedImage,
          });
        } catch {
          // Toast already surfaced; keep the modal closed because the
          // variant exists and the seller can attach an image later.
        }
      }
      setModalOpen(false);
    } catch (err) {
      // Logged by the mutation hooks' onError (toast). We also keep the
      // modal open so the seller can fix the form and retry without
      // losing their input — except when the mutation itself was the
      // root cause of a hard DB failure (e.g. unique-constraint or
      // FK violation), in which case the modal stays open too. The
      // catch is intentionally broad so the modal never closes on a
      // failed save.
      const msg = err instanceof Error ? err.message : "Failed to save variant";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-4">
      {/* Card header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Variants</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {variants.length} total · at least one variant is required per
              product.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                placeholder="Search SKU or name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#002b5b]/20 focus:border-[#002b5b]"
              />
            </div>
            <button
              type="button"
              onClick={handleAdd}
              className="inline-flex items-center gap-2 rounded-lg bg-[#002b5b] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#001f3f] transition-colors shadow-sm cursor-pointer"
            >
              <Plus size={14} aria-hidden /> Add variant
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyVariants onAdd={handleAdd} hasSearch={Boolean(search.trim())} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-3 w-16">Image</th>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">SKU</th>
                  <th className="px-6 py-3 text-right">Price</th>
                  <th className="px-6 py-3 w-40">Inventory</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((variant) => (
                  <VariantRow
                    key={variant.id}
                    variant={variant}
                    productId={product.id}
                    onEdit={() => handleEdit(variant)}
                    onRequestDelete={() => requestDelete(variant)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Need to leave this page?{" "}
        <button
          type="button"
          onClick={() => navigate("/products")}
          className="text-[#002b5b] hover:underline font-medium cursor-pointer"
        >
          Back to products
        </button>
      </p>

      <VariantFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        variant={editingVariant}
        productId={product.id}
        defaultPrice={product.basePrice}
        onSubmit={handleModalSubmit}
        isSubmitting={
          createVariant.isPending ||
          updateVariant.isPending ||
          uploadVariantImage.isPending
        }
      />

      <ConfirmDialog
        isOpen={pendingDeleteVariant !== null}
        isDestructive
        title="Delete variant?"
        description={
          pendingDeleteVariant
            ? `“${variantDisplayName(pendingDeleteVariant)}” (SKU ${pendingDeleteVariant.sku}) will be permanently removed.`
            : ""
        }
        confirmText="Delete variant"
        cancelText="Keep variant"
        isConfirming={deleteVariant.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={cancelDelete}
      />
    </div>
  );
}

function VariantRow({
  variant,
  productId,
  onEdit,
  onRequestDelete,
}: {
  variant: ProductVariant;
  productId: string;
  onEdit: () => void;
  onRequestDelete: () => void;
}) {
  const setInventory = useSetVariantInventory(productId);
  // `null` while NOT editing — keeps us off the useEffect setState lint
  // and avoids hammering React with renders on every cache update.
  const [draftQty, setDraftQty] = useState<number | null>(null);
  const editing = draftQty !== null;

  const enterEditMode = () => setDraftQty(variant.available ?? 0);
  const cancelEdit = () => setDraftQty(null);

  const stockBadge = useMemo(() => {
    const status = variant.stockStatus ?? "in_stock";
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
          status === "in_stock" && "bg-emerald-50 text-emerald-700",
          status === "low_stock" && "bg-amber-50 text-amber-700",
          status === "out_of_stock" && "bg-red-50 text-red-700",
        )}
      >
        {status === "in_stock" && "In stock"}
        {status === "low_stock" && "Low stock"}
        {status === "out_of_stock" && "Out of stock"}
      </span>
    );
  }, [variant.stockStatus]);

  const handleSave = async () => {
    if (draftQty === null) return;
    if (!Number.isFinite(draftQty) || draftQty < 0) return;
    try {
      await setInventory.mutateAsync({
        variantId: variant.id,
        quantity: draftQty,
      });
      setDraftQty(null);
    } catch {
      /* toast handled */
    }
  };

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-6 py-3">
        <VariantThumbnail variant={variant} />
      </td>
      <td className="px-6 py-3">
        <div className="font-medium text-slate-900">
          {variantDisplayName(variant)}
        </div>
        {!variant.isActive && (
          <span className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
            <Tag size={10} aria-hidden /> Hidden
          </span>
        )}
      </td>
      <td className="px-6 py-3 text-slate-600 font-mono text-xs">
        {variant.sku}
      </td>
      <td className="px-6 py-3 text-right font-medium text-slate-900 tabular-nums">
        {formatVnd(variant.price)}
      </td>
      <td className="px-6 py-3">
        {editing && draftQty !== null ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step={1}
              value={draftQty}
              onChange={(e) => setDraftQty(Number(e.target.value))}
              className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#002b5b]/20 focus:border-[#002b5b]"
              autoFocus
            />
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={setInventory.isPending}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-[#002b5b] text-white hover:bg-[#001f3f] disabled:opacity-50 cursor-pointer"
            >
              {setInventory.isPending ? "…" : "Save"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="px-2.5 py-1 text-xs font-medium rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-900 tabular-nums">
              {variant.available ?? 0}
            </span>
            <button
              type="button"
              onClick={enterEditMode}
              aria-label={`Edit inventory for ${
                variantDisplayName(variant) || variant.sku
              }`}
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 bg-slate-50 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
            >
              <Pencil size={14} aria-hidden />
            </button>
          </div>
        )}
      </td>
      <td className="px-6 py-3">{stockBadge}</td>
      <td className="px-6 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            aria-label="Edit variant"
          >
            <Edit size={16} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onRequestDelete}
            className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
            aria-label="Delete variant"
          >
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
      </td>
    </tr>
  );
}

/**
 * VariantThumbnail — small 40×40 chip shown in the variants table.
 *
 * Shows the variant's image (or the parent product's image as a
 * fallback, since most sellers reuse the main photo for un-imaged
 * variants). When neither is available, renders a neutral placeholder.
 */
function VariantThumbnail({ variant }: { variant: ProductVariant }) {
  const url = variant.imageUrl;
  return (
    <div className="w-10 h-10 rounded-md overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
      {url ? (
        <img
          src={url}
          alt={variant.sku}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <ImageOff size={16} className="text-slate-300" aria-hidden />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Product gallery — multi-image grid with main-image badge + per-tile remove.
 * ────────────────────────────────────────────────────────────────────────── */

interface StagedFile {
  id: string;
  file: File;
  previewUrl: string;
}

interface ProductImageGalleryProps {
  /**
   * The server-truth images the seller has chosen to keep. Tracked
   * locally by the parent so deletions don't hit the backend on every
   * click — they're batched into a single Save Gallery round-trip.
   */
  retainedImages: string[];
  stagedFiles: StagedFile[];
  isUploading: boolean;
  isPersisting: boolean;
  onRemoveRetained: (url: string) => void;
  onRemoveStaged: (stagedId: string) => void;
}

/**
 * Renders the combined "what we're keeping + what's pending upload" grid.
 *
 * The "retained" images (server-truth but edited locally) render first
 * in their kept order, with the first one badged as the "main" image.
 * Staged previews render after them with an amber "Pending" badge so
 * the seller knows those tiles haven't been committed to the server.
 */
function ProductImageGallery({
  retainedImages,
  stagedFiles,
  isUploading,
  isPersisting,
  onRemoveRetained,
  onRemoveStaged,
}: ProductImageGalleryProps) {
  const totalCount = retainedImages.length + stagedFiles.length;
  const empty = totalCount === 0;

  if (empty) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
        <ImageIcon size={28} className="mx-auto text-slate-300" aria-hidden />
        <p className="mt-2 text-sm font-medium text-slate-700">No images yet</p>
        <p className="mt-1 text-xs text-slate-500">
          Add up to 10 images. The first one becomes the storefront thumbnail.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {/* Retained server images — first one is the primary image. */}
      {retainedImages.map((url, index) => (
        <div
          key={`server-${url}-${index}`}
          className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-50 group"
        >
          <img
            src={toAbsoluteUrl(url)}
            alt={`Product image ${index + 1}`}
            className={cn(
              "w-full h-full object-cover",
              isPersisting && "opacity-70",
            )}
            loading="lazy"
          />
          {index === 0 && (
            <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#002b5b] text-white text-[11px] font-medium shadow">
              <Star size={11} aria-hidden /> Ảnh đại diện
            </span>
          )}
          {!isUploading && (
            <button
              type="button"
              onClick={() => onRemoveRetained(url)}
              disabled={isPersisting}
              aria-label="Remove image"
              className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-white/90 text-slate-500 hover:bg-red-50 hover:text-red-600 shadow cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 size={14} aria-hidden />
            </button>
          )}
          <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[11px]">
            #{index + 1}
          </span>
        </div>
      ))}

      {/* Staged (not yet uploaded) — preview + Clear only. */}
      {stagedFiles.map((staged, index) => (
        <div
          key={staged.id}
          className="relative aspect-square rounded-lg overflow-hidden border-2 border-dashed border-[#002b5b]/40 bg-slate-50"
        >
          <img
            src={staged.previewUrl}
            alt={staged.file.name}
            className="w-full h-full object-cover opacity-90"
          />
          <span
            className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500 text-white text-[11px] font-medium shadow"
            title={`Will become image #${retainedImages.length + index + 1} after Save`}
          >
            <GripVertical size={11} aria-hidden /> Pending
          </span>
          <button
            type="button"
            onClick={() => onRemoveStaged(staged.id)}
            disabled={isUploading}
            aria-label="Remove staged image"
            className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-white/90 text-slate-500 hover:bg-red-50 hover:text-red-600 shadow cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X size={14} aria-hidden />
          </button>
          <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[11px] truncate max-w-[80%]">
            {staged.file.name}
          </span>
        </div>
      ))}
    </div>
  );
}

function EmptyVariants({
  onAdd,
  hasSearch,
}: {
  onAdd: () => void;
  hasSearch: boolean;
}) {
  return (
    <div className="px-6 py-12 text-center">
      <span className="inline-flex w-12 h-12 rounded-full bg-slate-100 items-center justify-center mb-3">
        <BoxIcon size={20} className="text-slate-500" aria-hidden />
      </span>
      <h3 className="text-sm font-semibold text-slate-900">
        {hasSearch ? "No variants match your search" : "No variants yet"}
      </h3>
      <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
        {hasSearch
          ? "Try clearing the filter or adjusting your terms."
          : "Variants distinguish SKUs (color, size, storage…). Every product must have at least one."}
      </p>
      {!hasSearch && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#002b5b] px-4 py-2 text-sm font-medium text-white hover:bg-[#001f3f] transition-colors shadow-sm cursor-pointer"
        >
          <Plus size={14} aria-hidden /> Add your first variant
        </button>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Page-level chrome helpers
 * ────────────────────────────────────────────────────────────────────────── */

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Package;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 px-1 pb-3 text-sm font-medium border-b-2 transition-colors cursor-pointer",
        active
          ? "border-[#002b5b] text-[#002b5b]"
          : "border-transparent text-slate-500 hover:text-slate-900",
      )}
    >
      <Icon size={14} aria-hidden />
      {label}
    </button>
  );
}

function PageSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-200" />
        <div className="space-y-2 flex-1">
          <div className="h-6 w-1/3 rounded bg-slate-200" />
          <div className="h-4 w-1/2 rounded bg-slate-100" />
        </div>
      </div>
      <div className="border-b border-slate-200 flex gap-6">
        <div className="h-6 w-24 rounded bg-slate-200" />
        <div className="h-6 w-24 rounded bg-slate-100" />
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <div className="h-4 w-24 rounded bg-slate-100" />
          <div className="h-10 w-full rounded bg-slate-100" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-24 rounded bg-slate-100" />
          <div className="h-24 w-full rounded bg-slate-100" />
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="h-4 w-24 rounded bg-slate-100" />
            <div className="h-10 w-full rounded bg-slate-100" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-24 rounded bg-slate-100" />
            <div className="h-10 w-full rounded bg-slate-100" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
  onBack,
}: {
  message: string;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-6 py-12 text-center">
        <p className="text-base font-semibold text-red-600">
          Failed to load product
        </p>
        <p className="mt-1 text-sm text-slate-500">{message}</p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            Back to products
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 rounded-lg bg-[#002b5b] text-white text-sm font-medium hover:bg-[#001f3f] cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Re-used field/input styling (kept local so this page is self-contained)
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
    "w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900",
    "placeholder:text-slate-400 shadow-sm transition-colors",
    "focus:outline-none focus:ring-2 focus:ring-[#002b5b]/20 focus:border-[#002b5b]",
    hasError
      ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
      : "border-slate-200",
  ].join(" ");
}
