import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useKV } from '@github/spark/hooks'
import { usePushNotifications } from './use-push-notifications'

vi.mock('@github/spark/hooks', async () => {
    return {
        useKV: vi.fn()
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
    });
    const NotificationCtorWithStatics = NotificationCtor as any
    NotificationCtorWithStatics.permission = 'granted'
    NotificationCtorWithStatics.requestPermission = vi.fn(async () => 'granted' as NotificationPermission)
    vi.stubGlobal('Notification', NotificationCtor as unknown as typeof Notification)
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
})

describe('usePushNotifications', () => {
    it('syncs stored permission to the browser permission on mount when different', () => {
        const setter = vi.fn()
        vi.mocked(useKV).mockReturnValue([
            {
                enabled: false,
                permission: 'default',
                showForPriorities: { low: false, medium: true, high: true, critical: true },
            },
            setter,
        ] as any)

        const NotificationMock = globalThis.Notification as any
        NotificationMock.permission = 'granted'

        renderHook(() => usePushNotifications())

        expect(setter).toHaveBeenCalledWith(expect.any(Function))
        const updater = setter.mock.calls[0][0] as (prev: any) => any
        const updated = updater({ enabled: false, permission: 'default', showForPriorities: {} })
        expect(updated.permission).toBe('granted')
    })

    it('reports isSupported=true when Notification API is available', () => {
        const { result } = renderHook(() => usePushNotifications())
        // Notification is stubbed in this file's beforeEach.
        expect(result.current.isSupported).toBe(true)
    })

    it('reports isSupported=false when Notification API is unavailable', () => {
        vi.unstubAllGlobals()

        const { result } = renderHook(() => usePushNotifications())

        expect(result.current.isSupported).toBe(false)
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
        const calls = vi.mocked(setter).mock.calls
        const lastUpdater = calls[calls.length - 1][0] as (prev: any) => any
        const updated = lastUpdater({ enabled: false, permission: 'granted', showForPriorities: {} })
        expect(updated.permission).toBe('granted')
        expect(updated.enabled).toBe(true)
    })

    it('requestPermission returns "denied" and keeps notifications disabled', async () => {
        const setter = vi.fn()
        vi.mocked(useKV).mockReturnValue([
            {
                enabled: false,
                permission: 'default',
                showForPriorities: { low: false, medium: true, high: true, critical: true },
            },
            setter,
        ] as any)

        const NotificationMock = globalThis.Notification as any
        NotificationMock.requestPermission = vi.fn(async () => 'denied' as NotificationPermission)

        const { result } = renderHook(() => usePushNotifications())
        let permResult: NotificationPermission | undefined
        await act(async () => {
            permResult = await result.current.requestPermission()
        })

        expect(permResult).toBe('denied')
        expect(setter).toHaveBeenCalledWith(expect.any(Function))
        const calls = vi.mocked(setter).mock.calls
        const lastUpdater = calls[calls.length - 1][0] as (prev: any) => any
        const updated = lastUpdater({ enabled: false, permission: 'default', showForPriorities: {} })
        expect(updated.permission).toBe('denied')
        expect(updated.enabled).toBe(false)
    })

    it('requestPermission returns denied when Notification.requestPermission throws', async () => {
        const setter = vi.fn()
        vi.mocked(useKV).mockReturnValue([
            {
                enabled: false,
                permission: 'granted',
                showForPriorities: { low: false, medium: true, high: true, critical: true },
            },
            setter,
        ] as any)

        const NotificationMock = globalThis.Notification as any
        NotificationMock.requestPermission = vi.fn(async () => {
            throw new Error('permission failure')
        })
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

        const { result } = renderHook(() => usePushNotifications())
        const beforeCalls = setter.mock.calls.length
        let permResult: NotificationPermission | undefined
        await act(async () => {
            permResult = await result.current.requestPermission()
        })

        expect(permResult).toBe('denied')
        expect(errorSpy).toHaveBeenCalled()
        expect(setter.mock.calls.length).toBe(beforeCalls)

        errorSpy.mockRestore()
    })

    it('sendNotification returns null when Notification API is unavailable', () => {
        vi.unstubAllGlobals()

        const { result } = renderHook(() => usePushNotifications())
        expect(result.current.sendNotification('No API')).toBeNull()
    })

    it('sendNotification returns null when notifications are disabled (default)', () => {
        vi.mocked(useKV).mockReturnValue([
            {
                enabled: false,
                permission: 'granted',
                showForPriorities: { low: false, medium: true, high: true, critical: true }
            },
            vi.fn()
        ] as any)

        const { result } = renderHook(() => usePushNotifications())
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

    it('invokes onClick callback and closes the notification when clicked', () => {
        vi.mocked(useKV).mockReturnValue([
            {
                enabled: true,
                permission: 'granted',
                showForPriorities: { low: false, medium: true, high: true, critical: true },
            },
            vi.fn(),
        ] as any)

        const onClick = vi.fn()
        const { result } = renderHook(() => usePushNotifications())
        const notification = result.current.sendNotification('Interactive', { onClick }) as any

        expect(notification).not.toBeNull()
        expect(typeof notification.onclick).toBe('function')
        notification.onclick()

        expect(onClick).toHaveBeenCalledOnce()
        expect(notification.close).toHaveBeenCalledOnce()
    })

    it('uses critical priority defaults without auto-dismiss timeout', () => {
        vi.mocked(useKV).mockReturnValue([
            {
                enabled: true,
                permission: 'granted',
                showForPriorities: { low: false, medium: true, high: true, critical: true },
            },
            vi.fn(),
        ] as any)

        const timeoutSpy = vi.spyOn(globalThis, 'setTimeout')

        const { result } = renderHook(() => usePushNotifications())
        const notification = result.current.sendNotification('Critical', { priority: 'critical' })

        expect(notification).not.toBeNull()
        expect(timeoutSpy).not.toHaveBeenCalled()

        timeoutSpy.mockRestore()
    })

    it('auto-dismisses non-critical notifications after the configured timeout', () => {
        vi.useFakeTimers()

        vi.mocked(useKV).mockReturnValue([
            {
                enabled: true,
                permission: 'granted',
                showForPriorities: { low: false, medium: true, high: true, critical: true },
            },
            vi.fn(),
        ] as any)

        const { result } = renderHook(() => usePushNotifications())
        const notification = result.current.sendNotification('High', { priority: 'high' }) as any

        expect(notification).not.toBeNull()
        expect(notification.close).not.toHaveBeenCalled()

        act(() => {
            vi.advanceTimersByTime(10000)
        })

        expect(notification.close).toHaveBeenCalledOnce()

        vi.useRealTimers()
    })

    it('merges partial settings updates through updateSettings', () => {
        const setter = vi.fn()
        vi.mocked(useKV).mockReturnValue([
            {
                enabled: false,
                permission: 'granted',
                showForPriorities: { low: false, medium: true, high: true, critical: true },
            },
            setter,
        ] as any)

        const { result } = renderHook(() => usePushNotifications())

        act(() => {
            result.current.updateSettings({ enabled: true })
        })

        expect(setter).toHaveBeenCalledWith(expect.any(Function))
        const updater = setter.mock.calls[setter.mock.calls.length - 1][0] as (prev: any) => any
        const updated = updater({ enabled: false, permission: 'granted', showForPriorities: { low: false, medium: true, high: true, critical: true } })
        expect(updated.enabled).toBe(true)
        expect(updated.permission).toBe('granted')
    })

    it('testNotification sends a medium-priority test message', () => {
        vi.mocked(useKV).mockReturnValue([
            {
                enabled: true,
                permission: 'granted',
                showForPriorities: { low: false, medium: true, high: true, critical: true },
            },
            vi.fn(),
        ] as any)

        const { result } = renderHook(() => usePushNotifications())
        act(() => {
            result.current.testNotification()
        })

        const NotificationMock = globalThis.Notification as unknown as ReturnType<typeof vi.fn>
        expect(NotificationMock).toHaveBeenCalledWith(
            'Test Notification',
            expect.objectContaining({
                body: 'This is a test notification from TrainSync',
                tag: 'test-notification',
            })
        )
    })

    it('sendNotification uses medium as default priority when no options are passed', () => {
        vi.mocked(useKV).mockReturnValue([
            {
                enabled: true, permission: 'granted',
                showForPriorities: { low: false, medium: true, high: true, critical: true }
            },
            vi.fn()
        ] as any)

        const { result } = renderHook(() => usePushNotifications())
        const notif = result.current.sendNotification('message with default priority')
        expect(notif).not.toBeNull()

        const NotificationMock = globalThis.Notification as unknown as ReturnType<typeof vi.fn>
        expect(NotificationMock).toHaveBeenCalledWith(
            'message with default priority',
            expect.objectContaining({
                icon: '/icon-192.png',
                badge: '/badge-72.png',
                requireInteraction: false,
                silent: false,
            })
        )
    })
})
