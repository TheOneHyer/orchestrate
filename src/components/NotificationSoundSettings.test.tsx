import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NotificationSoundSettings } from './NotificationSoundSettings'

const mockUsePushNotifications = vi.fn()

vi.mock('@/hooks/use-push-notifications', () => ({
    usePushNotifications: () => mockUsePushNotifications(),
}))

describe('NotificationSoundSettings', () => {
    beforeEach(() => {
        mockUsePushNotifications.mockReset()
    })

    it('shows loading state when settings are unavailable', () => {
        mockUsePushNotifications.mockReturnValue({
            settings: null,
            updateSettings: vi.fn(),
            requestPermission: vi.fn(),
            testNotification: vi.fn(),
            isSupported: true,
        })

        render(<NotificationSoundSettings />)

        expect(screen.getByText(/loading settings/i)).toBeInTheDocument()
    })

    it('shows unsupported browser message when notifications are unavailable', () => {
        mockUsePushNotifications.mockReturnValue({
            settings: {
                permission: 'default',
                enabled: false,
                showForPriorities: { low: true, medium: true, high: true, critical: true },
            },
            updateSettings: vi.fn(),
            requestPermission: vi.fn(),
            testNotification: vi.fn(),
            isSupported: false,
        })

        render(<NotificationSoundSettings />)

        expect(screen.getByText(/browser notifications are not supported/i)).toBeInTheDocument()
    })

    it('requests permission when not granted', () => {
        const requestPermission = vi.fn()
        mockUsePushNotifications.mockReturnValue({
            settings: {
                permission: 'default',
                enabled: false,
                showForPriorities: { low: true, medium: true, high: true, critical: true },
            },
            updateSettings: vi.fn(),
            requestPermission,
            testNotification: vi.fn(),
            isSupported: true,
        })

        render(<NotificationSoundSettings />)

        fireEvent.click(screen.getByRole('button', { name: /enable notifications/i }))
        expect(requestPermission).toHaveBeenCalledOnce()
    })

    it('updates granted notification priority toggles', () => {
        const updateSettings = vi.fn()
        mockUsePushNotifications.mockReturnValue({
            settings: {
                permission: 'granted',
                enabled: true,
                showForPriorities: { low: true, medium: true, high: true, critical: true },
            },
            updateSettings,
            requestPermission: vi.fn(),
            testNotification: vi.fn(),
            isSupported: true,
        })

        render(<NotificationSoundSettings />)

        fireEvent.click(screen.getByLabelText(/low priority/i))
        expect(updateSettings).toHaveBeenCalledWith({
            showForPriorities: {
                low: false,
                medium: true,
                high: true,
                critical: true,
            },
        })
    })

    it('sends a test notification when the action button is clicked', () => {
        const testNotification = vi.fn()
        mockUsePushNotifications.mockReturnValue({
            settings: {
                permission: 'granted',
                enabled: true,
                showForPriorities: { low: true, medium: true, high: true, critical: true },
            },
            updateSettings: vi.fn(),
            requestPermission: vi.fn(),
            testNotification,
            isSupported: true,
        })

        render(<NotificationSoundSettings />)

        fireEvent.click(screen.getByRole('button', { name: /send test notification/i }))
        expect(testNotification).toHaveBeenCalledOnce()
    })
})
