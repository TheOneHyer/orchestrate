import { useState, useEffect, useRef } from 'react'
import { useKV } from '@github/spark/hooks'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Bell, X } from '@phosphor-icons/react'
import { usePushNotifications } from '@/hooks/use-push-notifications'

/**
 * Floating banner prompting the user to enable browser push notifications.
 *
 * The banner is displayed only when:
 * - Push notifications are supported in the current browser.
 * - The permission state is neither "granted" nor "denied" (i.e., it is still "default").
 * - The user has not previously dismissed the banner (persisted via KV storage).
 *
 * Clicking "Enable" calls `requestPermission` and then dismisses the banner regardless
 * of the outcome. The banner can also be dismissed without granting permission.
 */
export function NotificationPermissionBanner() {
  const { isSupported, settings, requestPermission } = usePushNotifications()
  const [dismissed, setDismissed] = useKV<boolean>('notification-banner-dismissed', false)
  const [isVisible, setIsVisible] = useState(false)
  const [isRequesting, setIsRequesting] = useState(false)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!isSupported) {
      setIsVisible(false)
      return
    }

    if (dismissed) {
      setIsVisible(false)
      return
    }

    if (settings?.permission === 'granted' || settings?.permission === 'denied') {
      setIsVisible(false)
      return
    }

    setIsVisible(true)
  }, [isSupported, settings?.permission, dismissed])

  /** Requests browser notification permission and dismisses the banner on success or denial. */
  const handleEnableNotifications = async () => {
    if (isRequesting) {
      return
    }

    setIsRequesting(true)

    try {
      const permission = await requestPermission()
      if (!isMountedRef.current) {
        return
      }

      if (permission === 'granted' || permission === 'denied') {
        setDismissed(true)
      }
    } catch (error) {
      // Dismiss the banner if permission flow fails so users can continue.
      console.error('notification permission request failed', error)
      if (isMountedRef.current) {
        setDismissed(true)
      }
    } finally {
      if (isMountedRef.current) {
        setIsRequesting(false)
      }
    }
  }

  /** Dismisses the notification permission banner without requesting permission. */
  const handleDismiss = () => {
    setDismissed(true)
  }

  if (!isVisible) {
    return null
  }

  return (
    <Card className="fixed bottom-6 right-6 z-50 w-96 border-primary/20 shadow-lg animate-in slide-in-from-bottom-5">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2">
            <Bell className="text-primary" size={20} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm mb-1">Enable Desktop Notifications</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Stay updated with important alerts about trainer schedules, certifications, and system notifications.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleEnableNotifications} disabled={isRequesting} aria-busy={isRequesting}>
                {isRequesting ? 'Enabling...' : 'Enable'}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismiss} disabled={isRequesting}>
                Maybe Later
              </Button>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 rounded-full"
            onClick={handleDismiss}
            disabled={isRequesting}
          >
            <X size={16} />
          </Button>
        </div>
      </div>
    </Card>
  )
}
