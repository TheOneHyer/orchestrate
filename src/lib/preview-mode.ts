/**
 * Controls whether the application loads pre-seeded demo data.
 *
 * - `'off'`   – Preview seeding is disabled; no seed data is loaded.
 * - `'full'`  – Seed data is loaded if the store is currently empty.
 * - `'force'` – Seed data is always loaded, overwriting any existing data.
 */
export type PreviewSeedMode = 'off' | 'full' | 'force'

/** The URL query-parameter key used to override the preview seed mode at runtime. */
const PREVIEW_SEED_QUERY_KEY = 'previewSeed'

/**
 * Converts a raw string value (from a query parameter or environment variable)
 * into a canonical {@link PreviewSeedMode}.
 *
 * The strings `"true"`, `"1"`, and `"on"` are treated as aliases for `"full"`.
 * Any other value (including `null`, `undefined`, or an empty string) resolves
 * to `"off"`.
 *
 * @param rawMode - The raw string to normalise; may be `null` or `undefined`.
 * @returns The corresponding {@link PreviewSeedMode}.
 */
function normalizeMode(rawMode: string | null | undefined): PreviewSeedMode {
    const mode = (rawMode || '').toLowerCase().trim()

    if (mode === 'full' || mode === 'force') {
        return mode
    }

    if (mode === 'true' || mode === '1' || mode === 'on') {
        return 'full'
    }

    return 'off'
}

/**
 * Resolves the active {@link PreviewSeedMode} from the current runtime context.
 *
 * Resolution order (first non-`'off'` value wins):
 * 1. The `previewSeed` URL query parameter (e.g. `?previewSeed=force`).
 * 2. The `VITE_PREVIEW_SEED` environment variable.
 *
 * @returns The resolved {@link PreviewSeedMode} for the current page load.
 */
export function getPreviewSeedMode(): PreviewSeedMode {
    if (typeof globalThis !== 'undefined' && globalThis.location && typeof globalThis.location.search === 'string') {
        const queryMode = new URLSearchParams(globalThis.location.search).get(PREVIEW_SEED_QUERY_KEY)
        const normalizedQueryMode = normalizeMode(queryMode)

        if (normalizedQueryMode !== 'off') {
            return normalizedQueryMode
        }
    }

    const envMode = normalizeMode(import.meta.env.VITE_PREVIEW_SEED)
    return envMode
}

/**
 * Returns `true` when seed data should be loaded, i.e. when `mode` is not
 * `'off'`.
 *
 * @param mode - The preview seed mode to test.
 * @returns `true` if seeding is enabled (`'full'` or `'force'`), `false` otherwise.
 */
export function isPreviewSeedEnabled(mode: PreviewSeedMode): boolean {
    return mode !== 'off'
}
