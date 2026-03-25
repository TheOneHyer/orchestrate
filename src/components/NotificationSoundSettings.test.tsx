import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PushNotificationSettings as NotificationSoundSettings } from './NotificationSoundSettings'

vi.mock('@/hooks/use-push-notifications', () => ({
    usePushNotifications: () => ({
        settings: {
            permission: 'granted',
            enabled: true,
            showForPriorities: { low: true, medium: true, high: true, critical: true },
        },
        updateSettings: vi.fn(),
        requestPermission: vi.fn(),
        testNotification: vi.fn(),
        isSupported: true,
    }),
}))

describe('NotificationSoundSettings (deprecated alias)', () => {
    it('renders without crashing via the backward-compatible alias export', () => {
        render(<NotificationSoundSettings />)

        expect(screen.getByRole('button', { name: /send test notification/i })).toBeInTheDocument()
    })
})
