export type PreviewSeedMode = 'off' | 'full' | 'force'

const PREVIEW_SEED_QUERY_KEY = 'previewSeed'

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

export function getPreviewSeedMode(): PreviewSeedMode {
    if (typeof window !== 'undefined') {
        const queryMode = new URLSearchParams(window.location.search).get(PREVIEW_SEED_QUERY_KEY)
        const normalizedQueryMode = normalizeMode(queryMode)

        if (normalizedQueryMode !== 'off') {
            return normalizedQueryMode
        }
    }

    const envMode = normalizeMode(import.meta.env.VITE_PREVIEW_SEED)
    return envMode
}

export function isPreviewSeedEnabled(mode: PreviewSeedMode): boolean {
    return mode !== 'off'
}
