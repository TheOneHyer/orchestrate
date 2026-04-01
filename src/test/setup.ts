import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    ResizeObserverMock.clearInstances()
    IntersectionObserverMock.clearInstances()
    NotificationMock.permission = 'default'
    NotificationMock.requestPermission = vi.fn(async () => 'granted' as NotificationPermission)
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

/**
 * Mock implementation of the browser {@link ResizeObserver} API for use in
 * Vitest / jsdom test environments where the native observer is unavailable.
 *
 * All created instances are stored in the static {@link ResizeObserverMock.instances}
 * array so that test helpers can inspect or trigger them programmatically.
 */
class ResizeObserverMock {
    static instances: ResizeObserverMock[] = []
    private readonly callback: ResizeObserverCallback
    private readonly observedElements: Set<Element> = new Set()

    /** @param callback - The observer callback invoked on size changes. */
    constructor(callback: ResizeObserverCallback) {
        this.callback = callback
        ResizeObserverMock.instances.push(this)
    }

    /**
     * Begins observing `target` for size changes.
     * @param target - The DOM element to observe.
     */
    observe(target: Element) {
        this.observedElements.add(target)
    }

    /**
     * Stops observing `target`.
     * @param target - The DOM element to stop observing.
     */
    unobserve(target: Element) {
        this.observedElements.delete(target)
    }

    /** Stops observing all currently observed elements. */
    disconnect() {
        this.observedElements.clear()
    }

    /**
     * Test helper: manually fires the observer callback with the supplied
     * entries, simulating a resize event.
     *
     * @param entries - Synthetic resize entries to pass to the callback.
     *   Defaults to an empty array.
     */
    trigger(entries: ResizeObserverEntry[] = []) {
        this.callback(entries, this as unknown as ResizeObserver)
    }

    /** Resets the static {@link ResizeObserverMock.instances} array. */
    static clearInstances() {
        ResizeObserverMock.instances = []
    }
}

vi.stubGlobal('__getResizeObservers', () => ResizeObserverMock.instances)

/**
 * Mock implementation of the browser {@link IntersectionObserver} API for use
 * in Vitest / jsdom test environments where the native observer is unavailable.
 *
 * All created instances are stored in the static
 * {@link IntersectionObserverMock.instances} array so that test helpers can
 * inspect or trigger them programmatically.
 */
class IntersectionObserverMock {
    static instances: IntersectionObserverMock[] = []
    private readonly callback: IntersectionObserverCallback
    readonly root: Element | Document | null
    readonly rootMargin: string
    readonly thresholds: ReadonlyArray<number>
    private readonly observedElements: Set<Element> = new Set()

    /**
     * @param callback - The observer callback invoked on intersection changes.
     * @param options - Standard {@link IntersectionObserverInit} options.
     */
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        this.callback = callback
        this.root = options?.root ?? null
        this.rootMargin = options?.rootMargin ?? '0px'
        this.thresholds = Array.isArray(options?.threshold)
            ? options.threshold
            : [options?.threshold ?? 0]
        IntersectionObserverMock.instances.push(this)
    }

    /**
     * Begins observing `target` for intersection changes.
     * @param target - The DOM element to observe.
     */
    observe(target: Element) {
        this.observedElements.add(target)
    }

    /**
     * Stops observing `target`.
     * @param target - The DOM element to stop observing.
     */
    unobserve(target: Element) {
        this.observedElements.delete(target)
    }

    /** Stops observing all currently observed elements. */
    disconnect() {
        this.observedElements.clear()
    }

    /**
     * Returns an empty array (no buffered records in the mock).
     * @returns An empty array.
     */
    takeRecords() {
        return []
    }

    /**
     * Test helper: manually fires the observer callback with the supplied
     * entries, simulating an intersection change event.
     *
     * @param entries - Synthetic intersection entries to pass to the callback.
     *   Defaults to an empty array.
     */
    trigger(entries: IntersectionObserverEntry[] = []) {
        this.callback(entries, this as unknown as IntersectionObserver)
    }

    /** Resets the static {@link IntersectionObserverMock.instances} array. */
    static clearInstances() {
        IntersectionObserverMock.instances = []
    }
}

vi.stubGlobal('__getIntersectionObservers', () => IntersectionObserverMock.instances)

/**
 * Mock implementation of the browser {@link Notification} API for use in
 * Vitest / jsdom test environments.
 *
 * Exposes static `permission` and `requestPermission` fields that tests can
 * override to simulate different permission states, and stores notification
 * constructor arguments as instance properties for assertion.
 */
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
    silent?: boolean | null

    /**
     * @param title - The notification title.
     * @param options - Standard {@link NotificationOptions}.
     */
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

    /** Closes the notification (no-op in the mock). */
    close() { }
}

/**
 * Mock implementation of the browser {@link HTMLAudioElement} API for use in
 * Vitest / jsdom test environments.
 *
 * All media methods (`load`, `play`, `pause`, `addEventListener`,
 * `removeEventListener`, `dispatchEvent`) are replaced with Vitest spy
 * functions, allowing tests to assert on playback behaviour without requiring
 * a real audio engine.
 */
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
