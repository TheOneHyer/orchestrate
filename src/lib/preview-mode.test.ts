import { afterEach, describe, expect, it, vi } from 'vitest'

import { getPreviewSeedMode, isPreviewSeedEnabled } from './preview-mode'

describe('preview-mode', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    describe('getPreviewSeedMode', () => {
        it('returns "off" when no query param is set', () => {
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

        it.each([
            ['FULL', 'full'],
            ['FORCE', 'force'],
        ])('normalizes explicit mode %s to %s', (input, expected) => {
            vi.stubGlobal('location', { search: `?previewSeed=${input}` })
            expect(getPreviewSeedMode()).toBe(expected)
        })

        it.each(['true', '1', 'on', 'TRUE', 'ON'])('normalizes %s to "full"', (alias) => {
            vi.stubGlobal('location', { search: `?previewSeed=${alias}` })
            expect(getPreviewSeedMode()).toBe('full')
        })

        it('returns "off" when location is unavailable (SSR-safe)', () => {
            vi.stubGlobal('location', undefined)
            expect(getPreviewSeedMode()).toBe('off')
        })

        it('returns "off" for unrecognized param values', () => {
            vi.stubGlobal('location', { search: '?previewSeed=maybe' })
            expect(getPreviewSeedMode()).toBe('off')
        })
    })

    describe('isPreviewSeedEnabled', () => {
        it.each([
            ['off', false],
            ['full', true],
            ['force', true],
        ] as const)('returns %s -> %s', (mode, expected) => {
            expect(isPreviewSeedEnabled(mode)).toBe(expected)
        })
    })
})
