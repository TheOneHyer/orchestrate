import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

    it('requests permission when not granted', async () => {
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

        await userEvent.click(screen.getByRole('button', { name: /enable notifications/i }))
        expect(requestPermission).toHaveBeenCalledOnce()
    })

    it('updates granted notification priority toggles', async () => {
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

        await userEvent.click(screen.getByLabelText(/low priority/i))
        expect(updateSettings).toHaveBeenCalledWith({
            showForPriorities: {
                low: false,
                medium: true,
                high: true,
                critical: true,
            },
        })
    })

    it('sends a test notification when the action button is clicked', async () => {
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

        await userEvent.click(screen.getByRole('button', { name: /send test notification/i }))

        it('shows denied message and does not call requestPermission when permission is denied', () => {
            const requestPermission = vi.fn()
            mockUsePushNotifications.mockReturnValue({
                settings: {
                    permission: 'denied',
                    enabled: false,
                    showForPriorities: { low: true, medium: true, high: true, critical: true },
                },
                updateSettings: vi.fn(),
                requestPermission,
                testNotification: vi.fn(),
                isSupported: true,
            })

            render(<NotificationSoundSettings />)
            expect(screen.getByText(/notifications are blocked/i)).toBeInTheDocument()
            expect(requestPermission).not.toHaveBeenCalled()
        })

        it('disables notifications when enabled is true and toggle is clicked', async () => {
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
            await userEvent.click(screen.getByRole('button', { name: /disable notifications/i }))
            expect(updateSettings).toHaveBeenCalledWith({ enabled: false })
        })
        expect(testNotification).toHaveBeenCalledOnce()
    })
})
