import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NotificationSettingsDialog } from './NotificationSettingsDialog'

const mockUsePushNotifications = vi.fn()

vi.mock('@/hooks/use-push-notifications', () => ({
  usePushNotifications: () => mockUsePushNotifications(),
}))

interface MockPushSettings {
  enabled: boolean
  permission: NotificationPermission
  showForPriorities: {
    low: boolean
    medium: boolean
    high: boolean
    critical: boolean
  }
}

interface MockPushHook {
  isSupported: boolean
  settings: MockPushSettings
  requestPermission: ReturnType<typeof vi.fn>
  updateSettings: ReturnType<typeof vi.fn>
  testNotification: ReturnType<typeof vi.fn>
}

function makeSettings(overrides: Partial<MockPushSettings> = {}): MockPushSettings {
  return {
    enabled: true,
    permission: 'granted' as NotificationPermission,
    showForPriorities: { low: true, medium: true, high: true, critical: true },
    ...overrides,
  }
}

function makeHook(overrides: Partial<MockPushHook> = {}): MockPushHook {
  return {
    isSupported: true,
    settings: makeSettings(),
    requestPermission: vi.fn(),
    updateSettings: vi.fn(),
    testNotification: vi.fn(),
    ...overrides,
  }
}

describe('NotificationSettingsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows unsupported message when notifications are not supported', () => {
    mockUsePushNotifications.mockReturnValue(makeHook({ isSupported: false }))

    render(<NotificationSettingsDialog open={true} onOpenChange={vi.fn()} />)

    expect(screen.getByText(/not supported in your browser/i)).toBeInTheDocument()
  })

  it('shows request-permission button when permission is default', () => {
    mockUsePushNotifications.mockReturnValue(
      makeHook({ settings: makeSettings({ permission: 'default' }) })
    )

    render(<NotificationSettingsDialog open={true} onOpenChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: /enable browser notifications/i })).toBeInTheDocument()
  })

  it('calls requestPermission when the enable button is clicked', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted')
    mockUsePushNotifications.mockReturnValue(
      makeHook({ settings: makeSettings({ permission: 'default' }), requestPermission })
    )

    render(<NotificationSettingsDialog open={true} onOpenChange={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /enable browser notifications/i }))

    expect(requestPermission).toHaveBeenCalledOnce()
  })

  it('shows denied-permission warning when permission is denied', () => {
    mockUsePushNotifications.mockReturnValue(
      makeHook({ settings: makeSettings({ permission: 'denied' }) })
    )

    render(<NotificationSettingsDialog open={true} onOpenChange={vi.fn()} />)

    expect(screen.getByText(/permission denied/i)).toBeInTheDocument()
    expect(screen.getByText(/browser settings/i)).toBeInTheDocument()
  })

  it('shows master enable switch when permission is granted', () => {
    mockUsePushNotifications.mockReturnValue(makeHook())

    render(<NotificationSettingsDialog open={true} onOpenChange={vi.fn()} />)

    expect(screen.getByLabelText(/enable push notifications/i)).toBeInTheDocument()
  })

  it('shows priority toggles when notifications are enabled and granted', () => {
    mockUsePushNotifications.mockReturnValue(makeHook())

    render(<NotificationSettingsDialog open={true} onOpenChange={vi.fn()} />)

    expect(screen.getByText(/low priority notifications/i)).toBeInTheDocument()
    expect(screen.getByText(/medium priority notifications/i)).toBeInTheDocument()
    expect(screen.getByText(/high priority notifications/i)).toBeInTheDocument()
    expect(screen.getByText(/critical priority notifications/i)).toBeInTheDocument()
  })

  it('hides priority toggles when master notifications are disabled', () => {
    mockUsePushNotifications.mockReturnValue(
      makeHook({ settings: makeSettings({ enabled: false }) })
    )

    render(<NotificationSettingsDialog open={true} onOpenChange={vi.fn()} />)

    expect(screen.queryByText(/low priority notifications/i)).not.toBeInTheDocument()
  })

  it('calls updateSettings when master switch is toggled', async () => {
    const updateSettings = vi.fn()
    mockUsePushNotifications.mockReturnValue(makeHook({ updateSettings }))

    render(<NotificationSettingsDialog open={true} onOpenChange={vi.fn()} />)

    const masterSwitch = screen.getByLabelText(/enable push notifications/i)
    await userEvent.click(masterSwitch)

    expect(updateSettings).toHaveBeenCalledWith({ enabled: false })
  })

  it('calls updateSettings with updated priorities when a priority switch is toggled', async () => {
    const updateSettings = vi.fn()
    mockUsePushNotifications.mockReturnValue(makeHook({ updateSettings }))

    render(<NotificationSettingsDialog open={true} onOpenChange={vi.fn()} />)

    await userEvent.click(screen.getByLabelText(/low priority notifications/i))

    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ showForPriorities: expect.objectContaining({ low: false }) })
    )
  })

  it('calls testNotification when send test notification is clicked', async () => {
    const testNotification = vi.fn()
    mockUsePushNotifications.mockReturnValue(makeHook({ testNotification }))

    render(<NotificationSettingsDialog open={true} onOpenChange={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /send test notification/i }))

    expect(testNotification).toHaveBeenCalledOnce()
  })

  it('calls onOpenChange when Done is clicked', async () => {
    const onOpenChange = vi.fn()
    mockUsePushNotifications.mockReturnValue(makeHook())

    render(<NotificationSettingsDialog open={true} onOpenChange={onOpenChange} />)

    await userEvent.click(screen.getByRole('button', { name: /^done$/i }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('handles requestPermission rejection without unhandled errors', async () => {
    const requestPermission = vi.fn().mockRejectedValue(new Error('permission-failure'))
    mockUsePushNotifications.mockReturnValue(
      makeHook({ settings: makeSettings({ permission: 'default' }), requestPermission })
    )

    render(<NotificationSettingsDialog open={true} onOpenChange={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /enable browser notifications/i }))

    expect(requestPermission).toHaveBeenCalledOnce()
    expect(await screen.findByText(/unable to request notification permission/i)).toBeInTheDocument()
  })

  it('does not render dialog content when closed', () => {
    mockUsePushNotifications.mockReturnValue(makeHook())

    render(<NotificationSettingsDialog open={false} onOpenChange={vi.fn()} />)

    expect(screen.queryByText(/notification settings/i)).not.toBeInTheDocument()
  })
})
