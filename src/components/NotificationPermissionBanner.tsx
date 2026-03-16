import { useState, useEffect, useRef } from 'react'
import { useKV } from '@github/spark/hooks'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Bell, X } from '@phosphor-icons/react'
import { usePushNotifications } from '@/hooks/use-push-notifications'

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

  const handleDismiss = () => {
    if (isRequesting) {
      return
    }

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
              <Button size="sm" onClick={handleEnableNotifications} disabled={isRequesting}>
                Enable
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
