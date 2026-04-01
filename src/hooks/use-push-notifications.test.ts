import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useKV } from '@github/spark/hooks'
import { usePushNotifications } from './use-push-notifications'

type PushNotificationSettings = ReturnType<typeof usePushNotifications>['settings']
type PushSettingsUpdater = PushNotificationSettings | ((current: PushNotificationSettings) => PushNotificationSettings)
type PushSettingsSetter = (newValue: PushSettingsUpdater) => void
type MutableNotificationConstructor = typeof Notification & {
    permission: NotificationPermission
    requestPermission: () => Promise<NotificationPermission>
}

const createSettingsSetter = () => vi.fn<PushSettingsSetter>()

vi.mock('@github/spark/hooks', async () => {
    return {
        useKV: vi.fn()
    }
})

beforeEach(() => {
    vi.mocked(useKV).mockImplementation((_key, defaultValue) => [defaultValue as any, vi.fn(), vi.fn()] as any)
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
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
})

describe('usePushNotifications', () => {
    it('falls back to default settings when persisted settings are undefined', () => {
        const setter = vi.fn()
        vi.mocked(useKV).mockReturnValue([undefined, setter, vi.fn()] as any)

        const NotificationMock = globalThis.Notification as any
        NotificationMock.permission = 'granted'

        const { result } = renderHook(() => usePushNotifications())

        expect(result.current.settings).toMatchObject({
            enabled: false,
            permission: 'default',
            showForPriorities: {
                low: false,
                medium: true,
                high: true,
                critical: true,
            },
        })

        expect(setter).toHaveBeenCalledWith(expect.any(Function))
        const updater = setter.mock.calls[0][0] as (prev: any) => any
        const updated = updater(undefined)
        expect(updated.permission).toBe('granted')
        expect(updated.showForPriorities.medium).toBe(true)
    })

    it('syncs stored permission to the browser permission on mount when different', () => {
        const setter = vi.fn()
        vi.mocked(useKV).mockReturnValue([
            {
                enabled: false,
                permission: 'default',
                showForPriorities: { low: false, medium: true, high: true, critical: true },
            },
            setter,
            vi.fn(),
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

    it('requestPermission returns denied when Notification API is unavailable', async () => {
        const hadNotification = Object.prototype.hasOwnProperty.call(globalThis, 'Notification')
        const originalNotification = globalThis.Notification
        delete (globalThis as { Notification?: typeof Notification }).Notification

        try {
            const { result } = renderHook(() => usePushNotifications())
            let permission: NotificationPermission | undefined

            await act(async () => {
                permission = await result.current.requestPermission()
            })

            expect(permission).toBe('denied')
        } finally {
            if (hadNotification) {
                vi.stubGlobal('Notification', originalNotification)
            }
        }
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
            setter,
            vi.fn(),
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

    it('requestPermission merges from DEFAULT_SETTINGS when current settings are undefined', async () => {
        const setter = vi.fn()
        vi.mocked(useKV).mockReturnValue([undefined, setter, vi.fn()] as any)

        const { result } = renderHook(() => usePushNotifications())
        await act(async () => {
            await result.current.requestPermission()
        })

        const calls = setter.mock.calls
        const permissionUpdater = calls[calls.length - 1][0] as (prev: any) => any
        const updated = permissionUpdater(undefined)
        expect(updated.permission).toBe('granted')
        expect(updated.enabled).toBe(true)
        expect(updated.showForPriorities.critical).toBe(true)
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
            vi.fn(),
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
            vi.fn(),
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
            vi.fn(),
            vi.fn(),
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
            vi.fn(),
            vi.fn(),
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
            vi.fn(),
            vi.fn(),
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
    })

    it('auto-dismisses low-priority notifications after 3000ms', () => {
        vi.useFakeTimers()

        vi.mocked(useKV).mockReturnValue([
            {
                enabled: true,
                permission: 'granted',
                showForPriorities: { low: true, medium: true, high: true, critical: true },
            },
            vi.fn(),
            vi.fn(),
        ] as any)

        const { result } = renderHook(() => usePushNotifications())
        const notification = result.current.sendNotification('Low', { priority: 'low' }) as any

        expect(notification).not.toBeNull()
        expect(notification.close).not.toHaveBeenCalled()

        act(() => {
            vi.advanceTimersByTime(3000)
        })

        expect(notification.close).toHaveBeenCalledOnce()
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
            vi.fn(),
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

    it('updateSettings merges with default settings when current is undefined', () => {
        const setter = vi.fn()
        vi.mocked(useKV).mockReturnValue([undefined, setter, vi.fn()] as any)

        const { result } = renderHook(() => usePushNotifications())

        act(() => {
            result.current.updateSettings({ enabled: true })
        })

        const updater = setter.mock.calls[setter.mock.calls.length - 1][0] as (prev: any) => any
        const updated = updater(undefined)
        expect(updated.enabled).toBe(true)
        expect(updated.permission).toBe('default')
        expect(updated.showForPriorities.medium).toBe(true)
    })

    it('testNotification sends a medium-priority test message', () => {
        vi.mocked(useKV).mockReturnValue([
            {
                enabled: true,
                permission: 'granted',
                showForPriorities: { low: false, medium: true, high: true, critical: true },
            },
            vi.fn(),
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
                body: 'This is a test notification from Orchestrate',
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
            createSettingsSetter(),
            vi.fn()
        ] as unknown as ReturnType<typeof useKV>)

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

    it('syncs browser permission denied state to settings on mount', () => {
        const setter = createSettingsSetter()
        vi.mocked(useKV).mockReturnValue([
            {
                enabled: true,
                permission: 'granted',
                showForPriorities: { low: false, medium: true, high: true, critical: true },
            },
            setter,
            vi.fn(),
        ] as unknown as ReturnType<typeof useKV>)

        const NotificationMock = globalThis.Notification as unknown as MutableNotificationConstructor
        NotificationMock.permission = 'denied'

        renderHook(() => usePushNotifications())

        expect(setter).toHaveBeenCalledWith(expect.any(Function))
        const calls = setter.mock.calls
        const permissionUpdater = calls[calls.length - 1][0] as (prev: PushNotificationSettings) => PushNotificationSettings
        const updated = permissionUpdater({
            enabled: true,
            permission: 'granted',
            showForPriorities: { low: false, medium: true, high: true, critical: true },
        })
        expect(updated.permission).toBe('denied')
    })

    it('returns null from sendNotification when permission is denied', () => {
        vi.mocked(useKV).mockReturnValue([
            {
                enabled: true,
                permission: 'denied',
                showForPriorities: { low: false, medium: true, high: true, critical: true },
            },
            createSettingsSetter(),
            vi.fn(),
        ] as unknown as ReturnType<typeof useKV>)

        const NotificationMock = globalThis.Notification as unknown as MutableNotificationConstructor
        NotificationMock.permission = 'denied'

        const { result } = renderHook(() => usePushNotifications())
        const notif = result.current.sendNotification('Should not send')

        expect(notif).toBeNull()
    })

    it('handles notification error event listener', () => {
        vi.mocked(useKV).mockReturnValue([
            {
                enabled: true,
                permission: 'granted',
                showForPriorities: { low: false, medium: true, high: true, critical: true },
            },
            createSettingsSetter(),
            vi.fn(),
        ] as unknown as ReturnType<typeof useKV>)

        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

        const { result } = renderHook(() => usePushNotifications())
        const notification = result.current.sendNotification('Test')

        expect(notification).not.toBeNull()

        if (notification?.onerror) {
            notification.onerror(new Event('error'))
        }

        expect(errorSpy).toHaveBeenCalledWith('Notification error:', expect.any(Event))

        errorSpy.mockRestore()
    })

    it('handles errors when notification creation fails', () => {
        vi.mocked(useKV).mockReturnValue([
            {
                enabled: true,
                permission: 'granted',
                showForPriorities: { low: false, medium: true, high: true, critical: true },
            },
            createSettingsSetter(),
            vi.fn(),
        ] as unknown as ReturnType<typeof useKV>)

        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

        // Store original Notification
        const OriginalNotification = globalThis.Notification

        try {
            const ThrowingNotification = vi.fn().mockImplementation(() => {
                throw new Error('Notification creation failed')
            }) as unknown as MutableNotificationConstructor
            ThrowingNotification.permission = 'granted'
            ThrowingNotification.requestPermission = vi.fn(async () => 'granted' as NotificationPermission)
            vi.stubGlobal('Notification', ThrowingNotification)

            const { result } = renderHook(() => usePushNotifications())
            const notification = result.current.sendNotification('Will fail')

            expect(notification).toBeNull()
            expect(errorSpy).toHaveBeenCalledWith('Failed to send notification:', expect.any(Error))
        } finally {
            errorSpy.mockRestore()
            vi.stubGlobal('Notification', OriginalNotification)
        }
    })
})
