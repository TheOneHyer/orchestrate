import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useIsMobile } from './use-mobile'

describe('use-mobile', () => {
    const originalInnerWidth = window.innerWidth
    const listeners = new Set<() => void>()
    let matchMediaSpy: ReturnType<typeof vi.spyOn> | undefined

    const setWidth = (width: number) =>
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width })

    afterEach(() => {
        setWidth(originalInnerWidth)
        listeners.clear()
        matchMediaSpy?.mockRestore()
        matchMediaSpy = undefined
    })

    it('returns true when viewport is narrower than 768px', () => {
        setWidth(375)
        const { result } = renderHook(() => useIsMobile())
        expect(result.current).toBe(true)
    })

    it('returns false when viewport is exactly 768px', () => {
        setWidth(768)
        const { result } = renderHook(() => useIsMobile())
        expect(result.current).toBe(false)
    })

    it('returns false when viewport is wider than 768px', () => {
        setWidth(1440)
        const { result } = renderHook(() => useIsMobile())
        expect(result.current).toBe(false)
    })

    it('updates when viewport width changes after mount', () => {
        matchMediaSpy = vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
            matches: window.innerWidth < 768,
            media: query,
            onchange: null,
            addListener: (listener: () => void) => { listeners.add(listener) },
            removeListener: (listener: () => void) => { listeners.delete(listener) },
            addEventListener: (_event: string, listener: () => void) => { listeners.add(listener) },
            removeEventListener: (_event: string, listener: () => void) => { listeners.delete(listener) },
            dispatchEvent: vi.fn(),
        }) as any)

        setWidth(1440)
        const { result } = renderHook(() => useIsMobile())
        expect(result.current).toBe(false)

        act(() => {
            setWidth(375)
            listeners.forEach(listener => listener())
        })

        expect(result.current).toBe(true)
    })
})
