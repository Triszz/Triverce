import { useEffect, useRef, useState } from "react";
import { useForm, useFormState } from "react-hook-form";
import { toast } from "sonner";
import {
  Camera,
  ImagePlus,
  Loader2,
  Save,
  Store,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useSellerProfile } from "../hooks/useSellerProfile";
import { useUpdateSellerProfile, uploadLogo } from "../hooks/useUpdateSellerProfile";
import { validateImageFile } from "@/lib/imageValidation";
import type { StoreProfile } from "../types/seller-profile";

/* ──────────────────────────────────────────────────────────────────────────
 * Types
 * ────────────────────────────────────────────────────────────────────────── */

type FormValues = StoreProfile;

interface LogoUploadState {
  preview: string; // current display URL
  uploading: boolean;
  error: string | null;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Shared form field wrapper
 *
 * Consistent label + input + error pattern used across both sections.
 * ────────────────────────────────────────────────────────────────────────── */

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}

function Field({ label, error, hint, required, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-red-500" aria-hidden>*</span>}
        </span>
        {hint && (
          <span className="block text-xs text-slate-400 mt-0.5">{hint}</span>
        )}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertCircle size={12} aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Logo upload component
 *
 * A circular drop zone showing the current logo or a placeholder. Hover
 * reveals a semi-transparent overlay with a Camera icon and "Upload" label.
 * Clicking anywhere on the zone opens the file picker. The parent tracks
 * `isDirty` through a `onLogoUploaded(url)` callback.
 * ────────────────────────────────────────────────────────────────────────── */

interface LogoUploadProps {
  currentUrl: string;
  onLogoUploaded: (url: string) => void;
  isUploading: boolean;
  uploadError: string | null;
  disabled?: boolean;
}

const LOGO_SIZE = 96;

function LogoUpload({
  currentUrl,
  onLogoUploaded,
  isUploading,
  uploadError,
  disabled,
}: LogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const displayUrl = isDragOver ? "" : currentUrl;
  const hasLogo = Boolean(displayUrl);

  const openPicker = () => {
    if (!disabled && !isUploading) inputRef.current?.click();
  };

  const handleFile = (file: File | null | undefined) => {
    if (!file) return;
    const err = validateImageFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    onLogoUploaded(URL.createObjectURL(file));
    uploadLogo(file)
      .then((url) => {
        toast.success("Logo uploaded successfully!");
        onLogoUploaded(url);
      })
      .catch((err: unknown) => {
        const errorMessage =
          (err as { response?: { data?: { message?: string } } })
            ?.response?.data?.message ||
          (err as Error)?.message ||
          "Logo upload failed. Please try again.";
        toast.error(errorMessage);
      });
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
        disabled={disabled || isUploading}
        aria-label="Upload store logo"
      />

      {/* Circular upload zone */}
      <button
        type="button"
        onClick={openPicker}
        onKeyDown={(e) => e.key === "Enter" && openPicker()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled && !isUploading) setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        disabled={disabled || isUploading}
        aria-label="Upload store logo"
        className={`
          relative rounded-full overflow-hidden select-none
          ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
          ${!disabled && !isUploading ? "hover:ring-2 hover:ring-[#002b5b] hover:ring-offset-2" : ""}
          transition-all duration-150
        `}
        style={{ width: LOGO_SIZE, height: LOGO_SIZE }}
      >
        {/* Background */}
        <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
          {isUploading ? (
            <Loader2 size={28} className="text-slate-400 animate-spin" aria-hidden />
          ) : hasLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayUrl}
              alt="Store logo"
              className="w-full h-full object-cover"
            />
          ) : (
            <ImagePlus size={28} className="text-slate-300" aria-hidden />
          )}
        </div>

        {/* Hover / drop overlay */}
        {(isDragOver || (!hasLogo && !isUploading)) && !disabled && (
          <div className="absolute inset-0 bg-[#002b5b]/70 flex flex-col items-center justify-center gap-1">
            <Camera size={20} className="text-white" aria-hidden />
            <span className="text-white text-xs font-medium">
              {isDragOver ? "Drop" : "Upload"}
            </span>
          </div>
        )}

        {/* Upload-replace icon shown on hover when logo exists */}
        {!isDragOver && hasLogo && !isUploading && !disabled && (
          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
            <Camera size={18} className="text-white" aria-hidden />
            <span className="text-white text-xs font-medium">Change</span>
          </div>
        )}
      </button>

      {/* Hint text */}
      <p className="text-xs text-slate-400 text-center">
        {hasLogo ? "Click to change logo" : "Click or drag to upload"}
      </p>

      {/* Upload error */}
      {uploadError && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertCircle size={12} aria-hidden />
          {uploadError}
        </p>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Full-page skeleton (shown during the initial profile fetch)
 * ────────────────────────────────────────────────────────────────────────── */

function PageSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-slate-100 rounded-md" />
      <div className="h-4 w-72 bg-slate-50 rounded-md" />

      <div className="space-y-4">
        {/* Brand identity card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="h-5 w-40 bg-slate-100 rounded-md" />
          <div className="flex gap-6 pt-2">
            <div className="w-24 h-24 bg-slate-100 rounded-full shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="h-4 w-full bg-slate-100 rounded-md" />
              <div className="h-20 w-full bg-slate-50 rounded-md" />
            </div>
          </div>
        </div>

        {/* Contact info card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="h-5 w-48 bg-slate-100 rounded-md" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="h-4 w-20 bg-slate-100 rounded-md" />
              <div className="h-10 bg-slate-100 rounded-md" />
            </div>
            <div className="space-y-1.5">
              <div className="h-4 w-14 bg-slate-100 rounded-md" />
              <div className="h-10 bg-slate-100 rounded-md" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="h-4 w-18 bg-slate-100 rounded-md" />
            <div className="h-20 bg-slate-50 rounded-md" />
          </div>
        </div>

        {/* Save button */}
        <div className="h-11 w-40 bg-slate-100 rounded-lg ml-auto" />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * StoreSettingsPage
 * ────────────────────────────────────────────────────────────────────────── */

export function StoreSettingsPage() {
  const { data, isLoading, isError, error } = useSellerProfile();
  const profile = data?.data;

  const updateMutation = useUpdateSellerProfile();

  // Logo upload state — tracked independently from the form so the upload
  // can happen before the save button is pressed.
  const [logoState, setLogoState] = useState<LogoUploadState>({
    preview: "",
    uploading: false,
    error: null,
  });

  // react-hook-form — default values are set once when the profile arrives.
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    defaultValues: {
      storeName: "",
      description: "",
      logoUrl: "",
      supportEmail: "",
      phone: "",
      address: "",
    },
  });

  const { errors: formErrors } = useFormState({ control });

  // Sync form defaults when the profile query resolves.
  // useEffect avoids overwriting user edits on re-renders.
  useEffect(() => {
    if (!profile) return;
    reset({
      storeName: profile.storeName,
      description: profile.description,
      logoUrl: profile.logoUrl,
      supportEmail: profile.supportEmail,
      phone: profile.phone,
      address: profile.address,
    });
    setLogoState((s) => ({ ...s, preview: profile.logoUrl }));
  }, [profile, reset]);

  // Called by LogoUpload when a logo upload succeeds. Updates both the
  // form's logoUrl field AND the local logo preview state.
  const handleLogoUploaded = (url: string) => {
    setLogoState((s) => ({ ...s, uploading: false, error: null }));
    setValue("logoUrl", url, { shouldDirty: true });
    setLogoState((s) => ({ ...s, preview: url }));
  };

  const onSubmit = async (values: FormValues) => {
    setLogoState((s) => ({ ...s, error: null }));
    try {
      await updateMutation.mutateAsync(values);
    } catch {
      setLogoState((s) => ({
        ...s,
        error: "Failed to save. Please try again.",
      }));
    }
  };

  const handleReset = () => {
    setLogoState((s) => ({ ...s, preview: profile?.logoUrl ?? "" }));
    reset({
      storeName: profile?.storeName ?? "",
      description: profile?.description ?? "",
      logoUrl: profile?.logoUrl ?? "",
      supportEmail: profile?.supportEmail ?? "",
      phone: profile?.phone ?? "",
      address: profile?.address ?? "",
    });
  };

  const isSaving = updateMutation.isPending;

  // Full-page skeleton during the initial fetch.
  if (isLoading) return <PageSkeleton />;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Store Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your storefront's brand identity and contact information.
        </p>
      </div>

      {/* Error banner */}
      {isError && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0" aria-hidden />
          <span>{(error as Error)?.message ?? "Failed to load store profile."}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="space-y-4"
      >
        {/* ── Section 1: Brand Identity ─────────────────────────────────── */}

        <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Store size={16} className="text-[#002b5b]" aria-hidden />
            <h2 className="text-base font-semibold text-slate-900">
              Brand Identity
            </h2>
          </div>

          {/* Logo + Store name side-by-side */}
          <div className="flex flex-col sm:flex-row gap-6 sm:items-start">
            {/* Logo upload — centered above the name field on mobile */}
            <LogoUpload
              currentUrl={logoState.preview}
              onLogoUploaded={handleLogoUploaded}
              isUploading={logoState.uploading}
              uploadError={logoState.error}
              disabled={isSaving}
            />

            {/* Text fields */}
            <div className="flex-1 space-y-4">
              <Field
                label="Store Name"
                error={formErrors.storeName?.message}
                required
              >
                <input
                  type="text"
                  placeholder="e.g. Ngọc Minh Tech Store"
                  maxLength={100}
                  disabled={isSaving}
                  className={`
                    w-full h-10 px-3 rounded-lg border text-sm text-slate-900
                    placeholder:text-slate-300 bg-white
                    focus:outline-none focus:ring-2 focus:ring-[#002b5b]/30 focus:border-[#002b5b]
                    disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
                    transition-colors duration-150
                    ${errors.storeName ? "border-red-400" : "border-slate-200"}
                  `}
                  {...register("storeName", {
                    required: "Store name is required",
                    maxLength: {
                      value: 100,
                      message: "Store name must be 100 characters or fewer",
                    },
                  })}
                />
              </Field>

              <Field
                label="Description"
                hint="Appears on your public storefront page"
                error={formErrors.description?.message}
              >
                <textarea
                  rows={4}
                  placeholder="Tell customers what makes your store special..."
                  maxLength={1000}
                  disabled={isSaving}
                  className={`
                    w-full px-3 py-2 rounded-lg border text-sm text-slate-900
                    placeholder:text-slate-300 bg-white resize-none
                    focus:outline-none focus:ring-2 focus:ring-[#002b5b]/30 focus:border-[#002b5b]
                    disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
                    transition-colors duration-150
                    ${errors.description ? "border-red-400" : "border-slate-200"}
                  `}
                  {...register("description", {
                    maxLength: {
                      value: 1000,
                      message: "Description must be 1000 characters or fewer",
                    },
                  })}
                />
              </Field>
            </div>
          </div>
        </section>

        {/* ── Section 2: Contact Information ─────────────────────────── */}

        <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Store size={16} className="text-[#002b5b]" aria-hidden />
            <h2 className="text-base font-semibold text-slate-900">
              Contact Information
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Support Email"
              hint="Customers will see this for support inquiries"
              error={formErrors.supportEmail?.message}
            >
              <input
                type="email"
                placeholder="support@yourstore.com"
                disabled={isSaving}
                className={`
                  w-full h-10 px-3 rounded-lg border text-sm text-slate-900
                  placeholder:text-slate-300 bg-white
                  focus:outline-none focus:ring-2 focus:ring-[#002b5b]/30 focus:border-[#002b5b]
                  disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
                  transition-colors duration-150
                  ${errors.supportEmail ? "border-red-400" : "border-slate-200"}
                `}
                {...register("supportEmail", {
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Enter a valid email address",
                  },
                })}
              />
            </Field>

            <Field
              label="Phone Number"
              hint="Shown on your storefront for urgent contact"
              error={formErrors.phone?.message}
            >
              <input
                type="tel"
                placeholder="0901 234 567"
                maxLength={20}
                disabled={isSaving}
                className={`
                  w-full h-10 px-3 rounded-lg border text-sm text-slate-900
                  placeholder:text-slate-300 bg-white
                  focus:outline-none focus:ring-2 focus:ring-[#002b5b]/30 focus:border-[#002b5b]
                  disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
                  transition-colors duration-150
                  ${errors.phone ? "border-red-400" : "border-slate-200"}
                `}
                {...register("phone", {
                  maxLength: {
                    value: 20,
                    message: "Phone number must be 20 characters or fewer",
                  },
                })}
              />
            </Field>
          </div>

          <Field
            label="Business Address"
            hint="Displayed on invoices and your storefront"
            error={formErrors.address?.message}
          >
            <textarea
              rows={3}
              placeholder="123 Đường ABC, Phường XYZ, Quận 1, TP. Hồ Chí Minh"
              maxLength={500}
              disabled={isSaving}
              className={`
                w-full px-3 py-2 rounded-lg border text-sm text-slate-900
                placeholder:text-slate-300 bg-white resize-none
                focus:outline-none focus:ring-2 focus:ring-[#002b5b]/30 focus:border-[#002b5b]
                disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
                transition-colors duration-150
                ${errors.address ? "border-red-400" : "border-slate-200"}
              `}
              {...register("address", {
                maxLength: {
                  value: 500,
                  message: "Address must be 500 characters or fewer",
                },
              })}
            />
          </Field>
        </section>

        {/* ── Actions ─────────────────────────────────────────────────── */}

        <div className="flex items-center gap-3">
          {/* Success toast */}
          {updateMutation.isSuccess && (
            <div className="flex items-center gap-1.5 text-sm text-emerald-600 animate-in fade-in slide-in-from-left-2">
              <CheckCircle2 size={16} aria-hidden />
              <span>Changes saved successfully.</span>
            </div>
          )}

          <div className="ml-auto flex items-center gap-3">
            {/* Reset — only visible when there are unsaved changes */}
            {isDirty && (
              <button
                type="button"
                onClick={handleReset}
                disabled={isSaving}
                className="
                  h-10 px-4 rounded-lg border border-slate-200 text-sm font-medium
                  text-slate-600 hover:bg-slate-50 hover:border-slate-300
                  disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
                  transition-colors duration-150
                "
              >
                Cancel
              </button>
            )}

            {/* Save — strictly disabled unless dirty or saving */}
            <button
              type="submit"
              disabled={(!isDirty && !isSaving) || isSaving}
              className={`
                h-10 px-6 rounded-lg text-sm font-semibold flex items-center gap-2
                transition-all duration-150
                ${
                  isSaving
                    ? "bg-[#002b5b] text-white opacity-70 cursor-not-allowed"
                    : isDirty
                    ? "bg-[#002b5b] text-white hover:bg-[#001f3f] cursor-pointer shadow-sm hover:shadow"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }
              `}
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                <>
                  <Save size={16} aria-hidden />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
