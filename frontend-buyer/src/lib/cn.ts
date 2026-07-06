import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines clsx (conditional class merging) with tailwind-merge
 * (resolves conflicting Tailwind classes so the last one wins).
 * Use everywhere a UI primitive composes classes from a `className` prop.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
