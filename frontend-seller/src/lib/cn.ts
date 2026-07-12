import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines clsx (conditional class merging) with tailwind-merge
 * (resolves conflicting Tailwind classes so the last one wins).
 * Mirrors `@/lib/cn` from frontend-buyer for cross-app consistency.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
