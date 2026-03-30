import { z } from "zod";

export const slugSchema = (maxLength = 255) =>
  z
    .string()
    .min(2, "Slug must have at least 2 characters")
    .max(maxLength, `Slug have a maximum of ${maxLength} characters`)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug can only contain lowercase letters, numbers, and hyphens (example: ao-thun-nam)",
    );
