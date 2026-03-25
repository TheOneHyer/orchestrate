import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PushNotificationSettings } from './PushNotificationSettings'

const mockUsePushNotifications = vi.fn()
const mockRequestPermission = vi.fn()
const mockUpdateSettings = vi.fn()
const mockTestNotification = vi.fn()

vi.mock('@/hooks/use-push-notifications', () => ({
    usePushNotifications: () => mockUsePushNotifications(),
}))

const grantedSettings = {
    permission: 'granted' as const,
    enabled: true,
    showForPriorities: {
        low: true,
        medium: true,
        high: true,
        critical: true,
    },
}

beforeEach(() => {
    mockRequestPermission.mockReset()
    mockUpdateSettings.mockReset()
    mockTestNotification.mockReset()
    mockUsePushNotifications.mockReturnValue({
        settings: grantedSettings,
        updateSettings: mockUpdateSettings,
        requestPermission: mockRequestPermission,
        testNotification: mockTestNotification,
        isSupported: true,
    })
})

describe('PushNotificationSettings', () => {
    it('renders loading state when settings are unavailable', () => {
        mockUsePushNotifications.mockReturnValue({
            settings: null,
            updateSettings: mockUpdateSettings,
            requestPermission: mockRequestPermission,
            testNotification: mockTestNotification,
            isSupported: true,
        })

        render(<PushNotificationSettings />)

        expect(screen.getByText(/loading settings/i)).toBeInTheDocument()
    })

    it('renders unsupported browser state', () => {
        mockUsePushNotifications.mockReturnValue({
            settings: { ...grantedSettings, permission: 'default', enabled: false },
            updateSettings: mockUpdateSettings,
            requestPermission: mockRequestPermission,
            testNotification: mockTestNotification,
            isSupported: false,
        })

        render(<PushNotificationSettings />)

        expect(screen.getByText(/not supported in your browser/i)).toBeInTheDocument()
    })

    it('requests permission when notifications have not been enabled yet', async () => {
        const user = userEvent.setup()

        mockUsePushNotifications.mockReturnValue({
            settings: { ...grantedSettings, permission: 'default', enabled: false },
            updateSettings: mockUpdateSettings,
            requestPermission: mockRequestPermission,
            testNotification: mockTestNotification,
            isSupported: true,
        })

        render(<PushNotificationSettings />)

        expect(screen.getByText(/not yet requested/i)).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: /enable notifications/i }))

        expect(mockRequestPermission).toHaveBeenCalledOnce()
    })

    it('shows an inline error when requesting permission fails', async () => {
        const user = userEvent.setup()
        mockRequestPermission.mockRejectedValue(new Error('permission failed'))

        mockUsePushNotifications.mockReturnValue({
            settings: { ...grantedSettings, permission: 'default', enabled: false },
            updateSettings: mockUpdateSettings,
            requestPermission: mockRequestPermission,
            testNotification: mockTestNotification,
            isSupported: true,
        })

        render(<PushNotificationSettings />)

        await user.click(screen.getByRole('button', { name: /enable notifications/i }))

        expect(await screen.findByRole('alert')).toHaveTextContent(/unable to enable notifications/i)
    })

    it('renders denied permission guidance', () => {
        mockUsePushNotifications.mockReturnValue({
            settings: { ...grantedSettings, permission: 'denied', enabled: false },
            updateSettings: mockUpdateSettings,
            requestPermission: mockRequestPermission,
            testNotification: mockTestNotification,
            isSupported: true,
        })

        render(<PushNotificationSettings />)

        expect(screen.getByText(/notifications are blocked/i)).toBeInTheDocument()
    })

    it('updates granted notification settings and sends a test notification', async () => {
        const user = userEvent.setup()

        render(<PushNotificationSettings />)

        await user.click(screen.getByRole('switch', { name: /browser notifications/i }))
        expect(mockUpdateSettings).toHaveBeenCalledWith({ enabled: false })

        await user.click(screen.getByRole('switch', { name: /low priority/i }))
        expect(mockUpdateSettings).toHaveBeenCalledWith({
            showForPriorities: {
                low: false,
                medium: true,
                high: true,
                critical: true,
            },
        })

        await user.click(screen.getByRole('switch', { name: /medium priority/i }))
        expect(mockUpdateSettings).toHaveBeenCalledWith({
            showForPriorities: {
                low: true,
                medium: false,
                high: true,
                critical: true,
            },
        })

        await user.click(screen.getByRole('switch', { name: /high priority/i }))
        expect(mockUpdateSettings).toHaveBeenCalledWith({
            showForPriorities: {
                low: true,
                medium: true,
                high: false,
                critical: true,
            },
        })

        await user.click(screen.getByRole('switch', { name: /critical priority/i }))
        expect(mockUpdateSettings).toHaveBeenCalledWith({
            showForPriorities: {
                low: true,
                medium: true,
                high: true,
                critical: false,
            },
        })

        await user.click(screen.getByRole('button', { name: /send test notification/i }))
        expect(mockTestNotification).toHaveBeenCalledOnce()
    })

    it('shows an inline error when updating settings fails', async () => {
        const user = userEvent.setup()
        mockUpdateSettings.mockRejectedValue(new Error('update failed'))

        render(<PushNotificationSettings />)

        await user.click(screen.getByRole('switch', { name: /browser notifications/i }))

        expect(await screen.findByRole('alert')).toHaveTextContent(/unable to update notification settings/i)
    })
})
