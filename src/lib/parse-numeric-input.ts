/**
 * Parse a numeric string into an integer with optional min/max clamping.
 *
 * Empty, non-finite, or non-numeric values fall back to the provided default.
 * The fallback value is also truncated to an integer so the return type is always
 * a normalized integer.
 *
 * @param value - Raw input value from form state.
 * @param fallbackValue - Value returned when parsing fails; truncated to an integer.
 * @param min - Optional minimum allowed value. Must be ≤ {@link max} when both are provided.
 * @param max - Optional maximum allowed value. Must be ≥ {@link min} when both are provided.
 * @returns A normalized integer suitable for numeric form fields.
 * @throws {Error} When both `min` and `max` are provided and `min` is greater than `max`.
 */
export function parseNumericInput(value: string, fallbackValue: number, min?: number, max?: number): number {
    if (min !== undefined && max !== undefined && min > max) {
        throw new Error(`parseNumericInput: min (${min}) must be less than or equal to max (${max})`)
    }

    if (value.trim() === '') {
        return Math.trunc(fallbackValue)
    }

    const parsedValue = Number(value)
    if (!Number.isFinite(parsedValue)) {
        return Math.trunc(fallbackValue)
    }

    let result = Math.trunc(parsedValue)
    if (min !== undefined) {
        result = Math.max(Math.trunc(min), result)
    }
    if (max !== undefined) {
        result = Math.min(Math.trunc(max), result)
    }

    return result
}
