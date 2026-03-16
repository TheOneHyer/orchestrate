import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    ResizeObserverMock.clearInstances()
    IntersectionObserverMock.clearInstances()
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
    static instances: ResizeObserverMock[] = []
    private readonly callback: ResizeObserverCallback
    private readonly observedElements: Set<Element> = new Set()

    constructor(callback: ResizeObserverCallback) {
        this.callback = callback
        ResizeObserverMock.instances.push(this)
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

    static clearInstances() {
        ResizeObserverMock.instances = []
    }
}

vi.stubGlobal('__getResizeObservers', () => ResizeObserverMock.instances)

class IntersectionObserverMock {
    static instances: IntersectionObserverMock[] = []
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
        IntersectionObserverMock.instances.push(this)
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

    static clearInstances() {
        IntersectionObserverMock.instances = []
    }
}

vi.stubGlobal('__getIntersectionObservers', () => IntersectionObserverMock.instances)

class NotificationMock {
    static permission: NotificationPermission = 'granted'
    static requestPermission = vi.fn(async () => 'granted' as NotificationPermission)
    title: string
    body?: string
    icon?: string
    tag?: string
    badge?: string
    data?: unknown
    requireInteraction?: boolean
    silent?: boolean

    constructor(title: string, options?: NotificationOptions) {
        this.title = title
        this.body = options?.body
        this.icon = options?.icon
        this.tag = options?.tag
        this.badge = options?.badge
        this.data = options?.data
        this.requireInteraction = options?.requireInteraction
        this.silent = options?.silent
    }

    close() { }
}

class AudioMock {
    src = ''
    volume = 1
    paused = true
    duration = 0
    muted = false
    loop = false
    currentTime = 0
    private readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()

    load = vi.fn(() => undefined)

    addEventListener = vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set())
        }

        this.listeners.get(type)?.add(listener)
    })

    removeEventListener = vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
        this.listeners.get(type)?.delete(listener)
    })

    play = vi.fn(async () => {
        this.paused = false
    })

    pause = vi.fn(() => {
        this.paused = true
    })

    dispatchEvent = vi.fn((event: Event | Record<string, unknown>): boolean => {
        const type = (event as Event).type
        const listeners = this.listeners.get(type)

        if (listeners) {
            listeners.forEach((listener) => {
                if (typeof listener === 'function') {
                    listener(event as Event)
                } else {
                    listener.handleEvent(event as Event)
                }
            })
        }

        return !((event as Event).defaultPrevented)
    })
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

if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => { }
}
