import { useState, useEffect, useCallback } from 'react'
import { useKV } from '@github/spark/hooks'
import { useNotificationSound } from './use-notification-sound'

interface PushNotificationSettings {
  enabled: boolean
  permission: NotificationPermission
  showForPriorities: {
    low: boolean
    medium: boolean
    high: boolean
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

export function usePushNotifications() {
  const [settings, setSettings] = useKV<PushNotificationSettings>(
    'push-notification-settings',
    DEFAULT_SETTINGS
  )
  const [isSupported] = useState(() => 'Notification' in window)
  const { settings: soundSettings } = useNotificationSound()

  const isWithinQuietHours = useCallback(() => {
    if (!soundSettings?.quietHours?.enabled) return false

    const now = new Date()
    const currentTime = now.getHours() * 60 + now.getMinutes()
    
    const startTime = soundSettings?.quietHours?.startTime || '22:00'
    const endTime = soundSettings?.quietHours?.endTime || '08:00'
    
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin

    if (startMinutes < endMinutes) {
      return currentTime >= startMinutes && currentTime < endMinutes
    } else {
      return currentTime >= startMinutes || currentTime < endMinutes
    }
  }, [soundSettings])

  useEffect(() => {
    if (!isSupported) return

    if (Notification.permission !== (settings?.permission || 'default')) {
      setSettings((current) => ({
        ...(current || DEFAULT_SETTINGS),
        permission: Notification.permission
      }))
    }
  }, [isSupported, settings?.permission, setSettings])

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
      data?: any
      priority?: 'low' | 'medium' | 'high' | 'critical'
      requireInteraction?: boolean
      silent?: boolean
      onClick?: () => void
    }
  ) => {
    const safeSettings = settings || DEFAULT_SETTINGS

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

    if (isWithinQuietHours()) {
      const allowCritical = soundSettings?.quietHours?.allowCritical ?? true
      if (priority !== 'critical' || !allowCritical) {
        return null
      }
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
  }, [isSupported, settings, isWithinQuietHours, soundSettings])

  const updateSettings = useCallback((updates: Partial<PushNotificationSettings>) => {
    setSettings((current) => ({
      ...(current || DEFAULT_SETTINGS),
      ...updates
    }))
  }, [setSettings])

  const testNotification = useCallback(() => {
    sendNotification('Test Notification', {
      body: 'This is a test notification from TrainSync',
      priority: 'medium',
      tag: 'test-notification'
    })
  }, [sendNotification])

  return {
    isSupported,
    settings: settings || DEFAULT_SETTINGS,
    requestPermission,
    sendNotification,
    updateSettings,
    testNotification
  }
}
