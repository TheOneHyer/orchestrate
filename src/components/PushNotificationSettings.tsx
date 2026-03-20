import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { usePushNotifications } from '@/hooks/use-push-notifications'
import { Bell } from '@phosphor-icons/react'

/**
 * Settings panel for managing browser push notification preferences.
 *
 * Renders a card-based UI that reflects the current push-notification permission state.
 * When permission is not yet granted, a button to request it is shown. When granted,
 * toggles for enabling notifications and filtering by priority level (low, medium, high,
 * critical) are displayed, along with a "Send Test Notification" button. Errors from
 * permission requests or settings updates are surfaced via an inline alert.
 */
export function PushNotificationSettings() {
  const { settings: pushSettings, updateSettings: updatePushSettings, requestPermission, testNotification, isSupported } = usePushNotifications()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleRequestPushPermission = async () => {
    setErrorMessage(null)
    try {
      await requestPermission()
    } catch (error) {
      console.error('Failed to request browser notification permission', error)
      setErrorMessage('Unable to enable notifications. Please try again.')
    }
  }

  const handleUpdatePushSettings = async (updates: Parameters<typeof updatePushSettings>[0]) => {
    setErrorMessage(null)
    try {
      await updatePushSettings(updates)
    } catch (error) {
      console.error('Failed to update browser notification settings', error)
      setErrorMessage('Unable to update notification settings. Please try again.')
    }
  }

  if (!pushSettings) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="text-primary" size={24} />
            <CardTitle>Browser Notifications</CardTitle>
          </div>
          <CardDescription>
            Manage browser push notification settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {errorMessage && (
            <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {errorMessage}
            </div>
          )}
          {!isSupported ? (
            <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
              Browser notifications are not supported in your browser
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Permission Status</Label>
                  <p className="text-sm text-muted-foreground">
                    {pushSettings.permission === 'granted' && 'Notifications enabled'}
                    {pushSettings.permission === 'denied' && 'Notifications blocked'}
                    {pushSettings.permission === 'default' && 'Not yet requested'}
                  </p>
                </div>
                {pushSettings.permission === 'default' && (
                  <Button onClick={handleRequestPushPermission}>
                    Enable Notifications
                  </Button>
                )}
                {pushSettings.permission === 'denied' && (
                  <p className="text-sm text-muted-foreground">
                    Notifications are blocked in your browser/site settings.
                  </p>
                )}
                )}
              </div>

              {pushSettings.permission === 'granted' && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="push-enabled">Browser Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Show notifications in your browser
                      </p>
                    </div>
                    <Switch
                      id="push-enabled"
                      checked={pushSettings.enabled}
                      onCheckedChange={(enabled) => void handleUpdatePushSettings({ enabled })}
                    />
                  </div>

                  {pushSettings.enabled && (
                    <>
                      <div className="space-y-3">
                        <Label>Show Notifications For</Label>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="priority-low" className="font-normal">Low Priority</Label>
                            <Switch
                              id="priority-low"
                              checked={pushSettings.showForPriorities.low}
                              onCheckedChange={(checked) =>
                                void handleUpdatePushSettings({
                                  showForPriorities: {
                                    ...pushSettings.showForPriorities,
                                    low: checked
                                  }
                                })
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor="priority-medium" className="font-normal">Medium Priority</Label>
                            <Switch
                              id="priority-medium"
                              checked={pushSettings.showForPriorities.medium}
                              onCheckedChange={(checked) =>
                                void handleUpdatePushSettings({
                                  showForPriorities: {
                                    ...pushSettings.showForPriorities,
                                    medium: checked
                                  }
                                })
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor="priority-high" className="font-normal">High Priority</Label>
                            <Switch
                              id="priority-high"
                              checked={pushSettings.showForPriorities.high}
                              onCheckedChange={(checked) =>
                                void handleUpdatePushSettings({
                                  showForPriorities: {
                                    ...pushSettings.showForPriorities,
                                    high: checked
                                  }
                                })
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor="priority-critical" className="font-normal">Critical Priority</Label>
                            <Switch
                              id="priority-critical"
                              checked={pushSettings.showForPriorities.critical}
                              onCheckedChange={(checked) =>
                                void handleUpdatePushSettings({
                                  showForPriorities: {
                                    ...pushSettings.showForPriorities,
                                    critical: checked
                                  }
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <Button variant="outline" onClick={testNotification} className="w-full">
                        <Bell size={16} />
                        Send Test Notification
                      </Button>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
