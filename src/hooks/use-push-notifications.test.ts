import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useKV } from '@github/spark/hooks'
import { usePushNotifications } from './use-push-notifications'

vi.mock('@github/spark/hooks', async () => {
    const { useState } = await import('react')
    return {
        useKV: vi.fn((_key: string, defaultValue: unknown) => useState(defaultValue))
    }
})

beforeEach(() => {
    vi.mocked(useKV).mockImplementation((_key, defaultValue) => [defaultValue as any, vi.fn()] as any)
    const NotificationCtor = vi.fn().mockImplementation(function (this: any, title: string, options?: NotificationOptions) {
        this.title = title
        this.options = options
        this.close = vi.fn()
        this.onclick = null
        this.onerror = null
    })
    ; (NotificationCtor as any).permission = 'granted'
    ; (NotificationCtor as any).requestPermission = vi.fn(async () => 'granted' as NotificationPermission)
    vi.stubGlobal('Notification', NotificationCtor as unknown as typeof Notification)
})

describe('usePushNotifications', () => {
    it('reports isSupported=true when Notification API is available', () => {
        const { result } = renderHook(() => usePushNotifications())
        // jsdom exposes a mocked Notification in setup.ts
        expect(result.current.isSupported).toBe(true)
    })

    it('requestPermission returns "granted" and updates settings to enabled', async () => {
        // Use permission='granted' in initial settings so the mount effect does not fire a
        // competing setSettings call (Notification.permission is already 'granted' in the mock)
        const setter = vi.fn()
        vi.mocked(useKV).mockReturnValue([
            {
                enabled: false, permission: 'granted',
                showForPriorities: { low: false, medium: true, high: true, critical: true }
            },
            setter
        ] as any)

        const { result } = renderHook(() => usePushNotifications())
        let permResult: NotificationPermission | undefined
        await act(async () => {
            permResult = await result.current.requestPermission()
        })

        expect(permResult).toBe('granted')
        expect(setter).toHaveBeenCalledWith(expect.any(Function))

        // Verify updater produces the correct merged settings
        const lastUpdater = vi.mocked(setter).mock.calls.at(-1)![0] as (prev: any) => any
        const updated = lastUpdater({ enabled: false, permission: 'granted', showForPriorities: {} })
        expect(updated.permission).toBe('granted')
        expect(updated.enabled).toBe(true)
    })

    it('sendNotification returns null when notifications are disabled (default)', () => {
        const { result } = renderHook(() => usePushNotifications())
        // default: enabled = false
        expect(result.current.sendNotification('Hello')).toBeNull()
    })

    it('sendNotification returns null for a priority excluded from showForPriorities', () => {
        vi.mocked(useKV).mockReturnValue([
            {
                enabled: true, permission: 'granted',
                showForPriorities: { low: false, medium: true, high: true, critical: true }
            },
            vi.fn()
        ] as any)

        const { result } = renderHook(() => usePushNotifications())
        expect(result.current.sendNotification('Low priority', { priority: 'low' })).toBeNull()
    })

    it('sendNotification creates and returns a Notification for an allowed priority', () => {
        vi.mocked(useKV).mockReturnValue([
            {
                enabled: true, permission: 'granted',
                showForPriorities: { low: false, medium: true, high: true, critical: true }
            },
            vi.fn()
        ] as any)

        const { result } = renderHook(() => usePushNotifications())
        const notif = result.current.sendNotification('High alert', { priority: 'high' })
        expect(notif).not.toBeNull()

        const NotificationMock = globalThis.Notification as unknown as ReturnType<typeof vi.fn>
        expect(NotificationMock).toHaveBeenCalledWith(
            'High alert',
            expect.objectContaining({
                icon: '/icon-192.png',
                badge: '/badge-72.png',
                requireInteraction: false,
                silent: false,
            })
        )
    })
})
