import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { useNotificationSound } from '@/hooks/use-notification-sound'
import { usePushNotifications } from '@/hooks/use-push-notifications'
import { SpeakerHigh, Bell, Moon, Play } from '@phosphor-icons/react'

export function NotificationSoundSettings() {
  const { settings: soundSettings, updateSettings: updateSoundSettings, testSound } = useNotificationSound()
  const { settings: pushSettings, updateSettings: updatePushSettings, requestPermission, testNotification, isSupported } = usePushNotifications()

  const handleRequestPushPermission = async () => {
    await requestPermission()
  }

  if (!soundSettings || !pushSettings) {
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
            <SpeakerHigh className="text-primary" size={24} />
            <CardTitle>Sound Settings</CardTitle>
          </div>
          <CardDescription>
            Configure notification sound preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sound-enabled">Sound Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Play a sound when notifications arrive
              </p>
            </div>
            <Switch
              id="sound-enabled"
              checked={soundSettings.enabled}
              onCheckedChange={(enabled) => updateSoundSettings({ enabled })}
            />
          </div>

          {soundSettings.enabled && (
            <>
              <div className="space-y-3">
                <Label htmlFor="sound-type">Sound Style</Label>
                <Select
                  value={soundSettings.soundType}
                  onValueChange={(soundType: any) => updateSoundSettings({ soundType })}
                >
                  <SelectTrigger id="sound-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="soft">Soft</SelectItem>
                    <SelectItem value="pleasant">Pleasant</SelectItem>
                    <SelectItem value="gentle">Gentle</SelectItem>
                    <SelectItem value="musical">Musical</SelectItem>
                    <SelectItem value="minimal">Minimal</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose a sound that matches your preference
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="volume">Volume</Label>
                  <span className="text-sm text-muted-foreground">
                    {Math.round(soundSettings.volume * 100)}%
                  </span>
                </div>
                <Slider
                  id="volume"
                  min={0}
                  max={1}
                  step={0.05}
                  value={[soundSettings.volume]}
                  onValueChange={([volume]) => updateSoundSettings({ volume })}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testSound('low')}
                >
                  <Play size={16} />
                  Test Low
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testSound('medium')}
                >
                  <Play size={16} />
                  Test Medium
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testSound('high')}
                >
                  <Play size={16} />
                  Test High
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testSound('critical')}
                >
                  <Play size={16} />
                  Test Critical
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Moon className="text-primary" size={24} />
            <CardTitle>Quiet Hours</CardTitle>
          </div>
          <CardDescription>
            Silence notifications during specific times
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="quiet-hours-enabled">Enable Quiet Hours</Label>
              <p className="text-sm text-muted-foreground">
                Mute notifications during specified hours
              </p>
            </div>
            <Switch
              id="quiet-hours-enabled"
              checked={soundSettings.quietHours.enabled}
              onCheckedChange={(enabled) =>
                updateSoundSettings({
                  quietHours: { ...soundSettings.quietHours, enabled }
                })
              }
            />
          </div>

          {soundSettings.quietHours.enabled && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-time">Start Time</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={soundSettings.quietHours.startTime}
                    onChange={(e) =>
                      updateSoundSettings({
                        quietHours: {
                          ...soundSettings.quietHours,
                          startTime: e.target.value
                        }
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-time">End Time</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={soundSettings.quietHours.endTime}
                    onChange={(e) =>
                      updateSoundSettings({
                        quietHours: {
                          ...soundSettings.quietHours,
                          endTime: e.target.value
                        }
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="allow-critical">Allow Critical Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Play sounds for critical notifications during quiet hours
                  </p>
                </div>
                <Switch
                  id="allow-critical"
                  checked={soundSettings.quietHours.allowCritical}
                  onCheckedChange={(allowCritical) =>
                    updateSoundSettings({
                      quietHours: { ...soundSettings.quietHours, allowCritical }
                    })
                  }
                />
              </div>

              <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                <p>
                  Quiet hours: {soundSettings.quietHours.startTime} to {soundSettings.quietHours.endTime}
                  {soundSettings.quietHours.allowCritical && ' (critical alerts only)'}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

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
                {pushSettings.permission !== 'granted' && (
                  <Button onClick={handleRequestPushPermission}>
                    Enable Notifications
                  </Button>
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
                      onCheckedChange={(enabled) => updatePushSettings({ enabled })}
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
                            <Label htmlFor="priority-medium" className="font-normal">Medium Priority</Label>
                            <Switch
                              id="priority-medium"
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
                            <Label htmlFor="priority-high" className="font-normal">High Priority</Label>
                            <Switch
                              id="priority-high"
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
                            <Label htmlFor="priority-critical" className="font-normal">Critical Priority</Label>
                            <Switch
                              id="priority-critical"
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
