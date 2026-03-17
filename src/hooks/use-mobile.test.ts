import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useIsMobile } from './use-mobile'

describe('use-mobile', () => {
    const originalInnerWidth = window.innerWidth
    const listeners = new Set<(event: MediaQueryListEvent) => void>()
    let matchMediaSpy: ReturnType<typeof vi.spyOn> | undefined

    const setWidth = (width: number) =>
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width })

    const mockMatchMedia = (width: number) => {
        setWidth(width)
        matchMediaSpy?.mockRestore()
        matchMediaSpy = vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
            const match = query.match(/max-width:\s*(\d+)px/)
            const breakpoint = match ? parseInt(match[1], 10) : 767
            return ({
                matches: width <= breakpoint,
                media: query,
                onchange: null,
                addListener: (listener: (event: MediaQueryListEvent) => void) => { listeners.add(listener) },
                removeListener: (listener: (event: MediaQueryListEvent) => void) => { listeners.delete(listener) },
                addEventListener: (_event: 'change', listener: (event: MediaQueryListEvent) => void) => { listeners.add(listener) },
                removeEventListener: (_event: 'change', listener: (event: MediaQueryListEvent) => void) => { listeners.delete(listener) },
                dispatchEvent: vi.fn(),
            }) as any
        })
    }

    afterEach(() => {
        setWidth(originalInnerWidth)
        listeners.clear()
        matchMediaSpy?.mockRestore()
        matchMediaSpy = undefined
    })

    it('returns true when viewport is narrower than 768px', () => {
        mockMatchMedia(375)
        const { result } = renderHook(() => useIsMobile())
        expect(result.current).toBe(true)
    })

    it('returns false when viewport is exactly 768px', () => {
        mockMatchMedia(768)
        const { result } = renderHook(() => useIsMobile())
        expect(result.current).toBe(false)
    })

    it('returns false when viewport is wider than 768px', () => {
        mockMatchMedia(1440)
        const { result } = renderHook(() => useIsMobile())
        expect(result.current).toBe(false)
    })

    it('updates when viewport width changes after mount', () => {
        const createMediaQueryEvent = (matches: boolean): MediaQueryListEvent => ({
            matches,
            media: '(max-width: 767px)',
        } as MediaQueryListEvent)

        mockMatchMedia(1440)
        const { result } = renderHook(() => useIsMobile())
        expect(result.current).toBe(false)

        act(() => {
            mockMatchMedia(375)
            listeners.forEach(listener => listener(createMediaQueryEvent(true)))
        })

        expect(result.current).toBe(true)
    })

    it('removes the media-query listener on unmount', () => {
        mockMatchMedia(1440)
        const { unmount } = renderHook(() => useIsMobile())

        expect(listeners.size).toBe(1)
        unmount()
        expect(listeners.size).toBe(0)
    })
})
