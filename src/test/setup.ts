import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
    }))
})

class ResizeObserverMock {
    private readonly callback: ResizeObserverCallback
    private readonly observedElements: Set<Element> = new Set()

    constructor(callback: ResizeObserverCallback) {
        this.callback = callback
    }

    observe(target: Element) {
        this.observedElements.add(target)
    }

    unobserve(target: Element) {
        this.observedElements.delete(target)
    }

    disconnect() {
        this.observedElements.clear()
    }

    // Optional test helper for manually triggering observer callbacks.
    trigger(entries: ResizeObserverEntry[] = []) {
        this.callback(entries, this as unknown as ResizeObserver)
    }
}

class IntersectionObserverMock {
    private readonly callback: IntersectionObserverCallback
    readonly root: Element | Document | null
    readonly rootMargin: string
    readonly thresholds: ReadonlyArray<number>
    private readonly observedElements: Set<Element> = new Set()

    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        this.callback = callback
        this.root = options?.root ?? null
        this.rootMargin = options?.rootMargin ?? '0px'
        this.thresholds = Array.isArray(options?.threshold)
            ? options.threshold
            : [options?.threshold ?? 0]
    }

    observe(target: Element) {
        this.observedElements.add(target)
    }

    unobserve(target: Element) {
        this.observedElements.delete(target)
    }

    disconnect() {
        this.observedElements.clear()
    }

    takeRecords() {
        return []
    }

    // Optional test helper for manually triggering observer callbacks.
    trigger(entries: IntersectionObserverEntry[] = []) {
        this.callback(entries, this as unknown as IntersectionObserver)
    }
}

class NotificationMock {
    static permission: NotificationPermission = 'granted'
    static requestPermission = vi.fn(async () => 'granted' as NotificationPermission)

    constructor(_title: string, _options?: NotificationOptions) { }

    close() { }
}

class AudioMock {
    play = vi.fn(async () => undefined)
    pause = vi.fn()
    currentTime = 0
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock)
vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
vi.stubGlobal('Notification', NotificationMock)
vi.stubGlobal('Audio', AudioMock)

if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false
}

if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => { }
}

if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => { }
}
