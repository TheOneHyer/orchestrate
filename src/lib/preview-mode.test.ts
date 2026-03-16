import { afterEach, describe, expect, it, vi } from 'vitest'

import { getPreviewSeedMode, isPreviewSeedEnabled } from './preview-mode'

describe('preview-mode', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    describe('getPreviewSeedMode', () => {
        it('returns "off" when no query param or env var is set', () => {
            vi.stubGlobal('location', { search: '' })
            expect(getPreviewSeedMode()).toBe('off')
        })

        it('returns "full" for ?previewSeed=full', () => {
            vi.stubGlobal('location', { search: '?previewSeed=full' })
            expect(getPreviewSeedMode()).toBe('full')
        })

        it('returns "force" for ?previewSeed=force', () => {
            vi.stubGlobal('location', { search: '?previewSeed=force' })
            expect(getPreviewSeedMode()).toBe('force')
        })

        it('normalizes truthy aliases to "full"', () => {
            for (const alias of ['true', '1', 'on', 'TRUE', 'ON']) {
                vi.stubGlobal('location', { search: `?previewSeed=${alias}` })
                expect(getPreviewSeedMode(), `alias "${alias}" should normalize to "full"`).toBe('full')
            }
        })

        it('returns "off" for unrecognized param values', () => {
            vi.stubGlobal('location', { search: '?previewSeed=maybe' })
            expect(getPreviewSeedMode()).toBe('off')
        })
    })

    describe('isPreviewSeedEnabled', () => {
        it('returns false for "off"', () => {
            expect(isPreviewSeedEnabled('off')).toBe(false)
        })

        it('returns true for "full"', () => {
            expect(isPreviewSeedEnabled('full')).toBe(true)
        })

        it('returns true for "force"', () => {
            expect(isPreviewSeedEnabled('force')).toBe(true)
        })
    })
})
