/**
 * Represents a normalized navigation target.
 */
export interface NavigationTarget {
    /** Internal view key used by the app shell. */
    view: string
    /** Optional context payload consumed by destination views. */
    data?: unknown
}

/**
 * Normalizes a view name or path-like navigation string into an internal
 * application view plus optional payload context.
 *
 * Examples:
 * - `schedule` -> `{ view: 'schedule' }`
 * - `/schedule` -> `{ view: 'schedule' }`
 * - `/people/abc-123` -> `{ view: 'people', data: { userId: 'abc-123' } }`
 *
 * @param value - Navigation string from internal clicks or notification links.
 * @returns A normalized navigation target, or `null` if the input is empty.
 */
export function normalizeNavigationValue(value: string): NavigationTarget | null {
    const trimmed = value.trim()
    if (!trimmed) {
        return null
    }

    if (!trimmed.startsWith('/')) {
        return { view: trimmed }
    }

    const path = trimmed.replace(/^\/+/, '')
    const normalizedPath = path.replace(/\/+$/, '')
    if (!normalizedPath) {
        return null
    }

    const [segment, id] = normalizedPath.split('/')
    if (segment === 'people' && id) {
        return {
            view: 'people',
            data: { userId: decodeURIComponent(id) },
        }
    }

    if (segment === 'schedule' && id) {
        return {
            view: 'schedule',
            data: { sessionId: decodeURIComponent(id) },
        }
    }

    return { view: normalizedPath }
}
