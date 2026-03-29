import { useState, useEffect, useCallback } from 'react'
import { useKV } from '@github/spark/hooks'

/**
 * Persisted user preferences for browser push notifications.
 */
interface PushNotificationSettings {
  /** Whether push notifications are globally enabled by the user. */
  enabled: boolean
  /** The current browser notification permission state (`'default'`, `'granted'`, or `'denied'`). */
  permission: NotificationPermission
  /** Controls which priority levels trigger a push notification. */
  showForPriorities: {
    /** Show notifications for low-priority alerts. */
    low: boolean
    /** Show notifications for medium-priority alerts. */
    medium: boolean
    /** Show notifications for high-priority alerts. */
    high: boolean
    /** Show notifications for critical-priority alerts. */
    critical: boolean
  }
}

const DEFAULT_SETTINGS: PushNotificationSettings = {
  enabled: false,
  permission: 'default',
  showForPriorities: {
    low: false,
    medium: true,
    high: true,
    critical: true
  }
}

/**
 * Hook that manages browser push notification permissions and delivery.
 *
 * Settings (enabled state, permission, per-priority toggles) are persisted via
 * KV storage. The hook syncs the stored permission value with the browser's
 * current `Notification.permission` on every render cycle.
 *
 * @returns An object containing:
 *   - `isSupported` – Whether the Notifications API is available in this browser.
 *   - `settings` – Current {@link PushNotificationSettings}.
 *   - `requestPermission` – Prompt the user for notification permission; returns the resulting {@link NotificationPermission}.
 *   - `sendNotification` – Fire a push notification if permissions and priority filters allow.
 *   - `updateSettings` – Merge partial settings updates into the persisted store.
 *   - `testNotification` – Send a sample notification to verify the setup.
 */
export function usePushNotifications() {
  const [settings, setSettings] = useKV<PushNotificationSettings>(
    'push-notification-settings',
    DEFAULT_SETTINGS
  )
  const [isSupported] = useState(() => 'Notification' in window)

  const safeSettings = settings || DEFAULT_SETTINGS

  useEffect(() => {
    if (!isSupported) return

    if (Notification.permission !== safeSettings.permission) {
      setSettings((current) => ({
        ...(current || DEFAULT_SETTINGS),
        permission: Notification.permission
      }))
    }
  }, [isSupported, safeSettings.permission, setSettings])

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      return 'denied' as NotificationPermission
    }

    try {
      const permission = await Notification.requestPermission()
      
      setSettings((current) => ({
        ...(current || DEFAULT_SETTINGS),
        permission,
        enabled: permission === 'granted'
      }))

      return permission
    } catch (error) {
      console.error('Failed to request notification permission:', error)
      return 'denied' as NotificationPermission
    }
  }, [isSupported, setSettings])

  const sendNotification = useCallback((
    title: string,
    options?: {
      body?: string
      icon?: string
      badge?: string
      tag?: string
      data?: unknown
      priority?: 'low' | 'medium' | 'high' | 'critical'
      requireInteraction?: boolean
      silent?: boolean
      onClick?: () => void
    }
  ) => {
    if (!isSupported) {
      console.warn('Push notifications are not supported in this browser')
      return null
    }

    if (!safeSettings.enabled || Notification.permission !== 'granted') {
      return null
    }

    const priority = options?.priority || 'medium'
    if (!safeSettings.showForPriorities[priority]) {
      return null
    }

    try {
      const notification = new Notification(title, {
        body: options?.body,
        icon: options?.icon || '/icon-192.png',
        badge: options?.badge || '/badge-72.png',
        tag: options?.tag,
        data: options?.data,
        requireInteraction: options?.requireInteraction || priority === 'critical',
        silent: options?.silent || false
      })

      if (options?.onClick) {
        notification.onclick = () => {
          options.onClick?.()
          notification.close()
        }
      }

      notification.onerror = (error) => {
        console.error('Notification error:', error)
      }

      if (!options?.requireInteraction && priority !== 'critical') {
        const timeout = priority === 'high' ? 10000 : priority === 'medium' ? 5000 : 3000
        setTimeout(() => {
          notification.close()
        }, timeout)
      }

      return notification
    } catch (error) {
      console.error('Failed to send notification:', error)
      return null
    }
  }, [isSupported, safeSettings])

  const updateSettings = useCallback((updates: Partial<PushNotificationSettings>) => {
    setSettings((current) => ({
      ...(current || DEFAULT_SETTINGS),
      ...updates
    }))
  }, [setSettings])

  const testNotification = useCallback(() => {
    sendNotification('Test Notification', {
      body: 'This is a test notification from Orchestrate',
      priority: 'medium',
      tag: 'test-notification'
    })
  }, [sendNotification])

  return {
    isSupported,
    settings: safeSettings,
    requestPermission,
    sendNotification,
    updateSettings,
    testNotification
  }
}
