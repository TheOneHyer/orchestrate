import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merges Tailwind CSS class names, resolving conflicts using tailwind-merge
 * and conditionally applying classes via clsx.
 *
 * @param inputs - One or more class values (strings, objects, arrays, etc.) to merge.
 * @returns A single merged class name string with Tailwind conflicts resolved.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
