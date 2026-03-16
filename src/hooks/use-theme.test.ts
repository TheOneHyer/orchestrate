import { useState } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useKV } from '@github/spark/hooks'

vi.mock('@github/spark/hooks', async () => {
    const { useState } = await import('react')
    return {
        useKV: vi.fn((_key: string, defaultValue: unknown) => useState(defaultValue))
    }
})

import { useTheme } from './use-theme'

describe('use-theme', () => {
    afterEach(() => {
        document.documentElement.classList.remove('light', 'dark')
    })

    it('defaults to "light" theme and applies the class to the document root', () => {
        const { result } = renderHook(() => useTheme())
        expect(result.current.theme).toBe('light')
        expect(document.documentElement.classList.contains('light')).toBe(true)
    })

    it('toggleTheme switches from light to dark and updates the DOM class', () => {
        const { result } = renderHook(() => useTheme())
        expect(result.current.theme).toBe('light')

        act(() => result.current.toggleTheme())
        expect(result.current.theme).toBe('dark')
        expect(document.documentElement.classList.contains('dark')).toBe(true)
        expect(document.documentElement.classList.contains('light')).toBe(false)
    })

    it('toggleTheme switches from dark to light', () => {
        vi.mocked(useKV).mockImplementationOnce((_key, _defaultValue) => useState('dark' as any))
        const { result } = renderHook(() => useTheme())
        expect(result.current.theme).toBe('dark')

        act(() => result.current.toggleTheme())
        expect(result.current.theme).toBe('light')
        expect(document.documentElement.classList.contains('light')).toBe(true)
        expect(document.documentElement.classList.contains('dark')).toBe(false)
    })
})
