import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { usePushNotifications } from '@/hooks/use-push-notifications'
import { Bell, Warning } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface NotificationSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NotificationSettingsDialog({ open, onOpenChange }: NotificationSettingsDialogProps) {
  const {
    isSupported,
    settings: pushSettings,
    requestPermission,
    updateSettings: updatePushSettings,
    testNotification
  } = usePushNotifications()

  const [isRequestingPermission, setIsRequestingPermission] = useState(false)

  const handleRequestPermission = async () => {
    setIsRequestingPermission(true)
    await requestPermission()
    setIsRequestingPermission(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Notification Settings</DialogTitle>
          <DialogDescription>
            Configure browser push notifications for TrainSync
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="text-primary" weight="duotone" size={24} />
              <h3 className="text-lg font-semibold">Browser Push Notifications</h3>
            </div>

            {!isSupported && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <Warning className="text-muted-foreground" size={20} />
                <p className="text-sm text-muted-foreground">
                  Push notifications are not supported in your browser
                </p>
              </div>
            )}

            {isSupported && (
              <div className="space-y-4">
                {pushSettings.permission === 'default' && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Browser notifications allow you to receive alerts even when TrainSync is not in focus.
                    </p>
                    <Button
                      onClick={handleRequestPermission}
                      disabled={isRequestingPermission}
                      className="w-full"
                    >
                      <Bell size={16} className="mr-2" />
                      {isRequestingPermission ? 'Requesting Permission...' : 'Enable Browser Notifications'}
                    </Button>
                  </div>
                )}

                {pushSettings.permission === 'denied' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-md">
                      <Warning className="text-destructive" size={20} />
                      <p className="text-sm text-destructive">
                        Browser notification permission denied
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      To enable notifications, you'll need to update your browser settings and allow notifications for this site.
                    </p>
                  </div>
                )}

                {pushSettings.permission === 'granted' && (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="push-enabled">Enable Push Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Receive browser notifications
                        </p>
                      </div>
                      <Switch
                        id="push-enabled"
                        checked={pushSettings.enabled}
                        onCheckedChange={(enabled) => updatePushSettings({ enabled })}
                      />
                    </div>

                    {pushSettings.enabled && (
                      <>
                        <Separator />

                        <div className="space-y-3">
                          <Label>Notification Priorities</Label>
                          <p className="text-sm text-muted-foreground">
                            Choose which priority levels trigger browser notifications
                          </p>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-muted">Low</Badge>
                                <span className="text-sm">Low priority notifications</span>
                              </div>
                              <Switch
                                checked={pushSettings.showForPriorities.low}
                                onCheckedChange={(checked) =>
                                  updatePushSettings({
                                    showForPriorities: {
                                      ...pushSettings.showForPriorities,
                                      low: checked
                                    }
                                  })
                                }
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900/30">Medium</Badge>
                                <span className="text-sm">Medium priority notifications</span>
                              </div>
                              <Switch
                                checked={pushSettings.showForPriorities.medium}
                                onCheckedChange={(checked) =>
                                  updatePushSettings({
                                    showForPriorities: {
                                      ...pushSettings.showForPriorities,
                                      medium: checked
                                    }
                                  })
                                }
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-accent">High</Badge>
                                <span className="text-sm">High priority notifications</span>
                              </div>
                              <Switch
                                checked={pushSettings.showForPriorities.high}
                                onCheckedChange={(checked) =>
                                  updatePushSettings({
                                    showForPriorities: {
                                      ...pushSettings.showForPriorities,
                                      high: checked
                                    }
                                  })
                                }
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="destructive">Critical</Badge>
                                <span className="text-sm">Critical priority notifications</span>
                              </div>
                              <Switch
                                checked={pushSettings.showForPriorities.critical}
                                onCheckedChange={(checked) =>
                                  updatePushSettings({
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

                        <Separator />

                        <div className="space-y-2">
                          <Label>Test Notification</Label>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={testNotification}
                            className="w-full"
                          >
                            <Bell size={16} className="mr-2" />
                            Send Test Notification
                          </Button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
