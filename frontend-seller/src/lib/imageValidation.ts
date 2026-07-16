/**
 * Image upload validation — shared across the seller dashboard.
 *
 * Rules (mirrored on the backend in `multer.config.ts`):
 *   • MIME type must be one of: JPEG, PNG, WebP.
 *   • Size must be strictly under 5 MB.
 *
 * `validateImageFile` returns either `null` (valid) or a short,
 * human-readable reason that's safe to drop into a toast or inline
 * error message.
 */

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const ALLOWED_IMAGE_FORMATS_LABEL = 'JPEG, PNG, WebP';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_SIZE_LABEL = '5MB';
export const IMAGE_VALIDATION_HELPER_TEXT = `Accepted formats: ${ALLOWED_IMAGE_FORMATS_LABEL}. Max size: ${MAX_IMAGE_SIZE_LABEL}.`;

/**
 * Validates a single File against the dashboard's image rules.
 * Returns `null` if the file passes; otherwise a short string the
 * caller can show in a toast / inline error.
 */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
    return `File "${file.name}" must be ${ALLOWED_IMAGE_FORMATS_LABEL}.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `File "${file.name}" exceeds ${MAX_IMAGE_SIZE_LABEL}.`;
  }
  return null;
}
