import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NotificationPermissionBanner } from './NotificationPermissionBanner'

const mockUseKV = vi.fn()
const mockUsePushNotifications = vi.fn()

vi.mock('@github/spark/hooks', () => ({
    useKV: (...args: unknown[]) => mockUseKV(...args),
}))

vi.mock('@/hooks/use-push-notifications', () => ({
    usePushNotifications: () => mockUsePushNotifications(),
}))

describe('NotificationPermissionBanner', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('does not render when notifications are unsupported', () => {
        mockUsePushNotifications.mockReturnValue({
            isSupported: false,
            settings: { permission: 'default' },
            requestPermission: vi.fn(),
        })
        mockUseKV.mockReturnValue([false, vi.fn()])

        const { container } = render(<NotificationPermissionBanner />)

        expect(container).toBeEmptyDOMElement()
    })

    it('does not render when previously dismissed', () => {
        mockUsePushNotifications.mockReturnValue({
            isSupported: true,
            settings: { permission: 'default' },
            requestPermission: vi.fn(),
        })
        mockUseKV.mockReturnValue([true, vi.fn()])

        const { container } = render(<NotificationPermissionBanner />)

        expect(container).toBeEmptyDOMElement()
    })

    it('does not render when permission is granted', () => {
        mockUsePushNotifications.mockReturnValue({
            isSupported: true,
            settings: { permission: 'granted' },
            requestPermission: vi.fn(),
        })
        mockUseKV.mockReturnValue([false, vi.fn()])

        const { container } = render(<NotificationPermissionBanner />)

        expect(container).toBeEmptyDOMElement()
    })

    it('does not render when permission is denied', () => {
        mockUsePushNotifications.mockReturnValue({
            isSupported: true,
            settings: { permission: 'denied' },
            requestPermission: vi.fn(),
        })
        mockUseKV.mockReturnValue([false, vi.fn()])

        const { container } = render(<NotificationPermissionBanner />)

        expect(container).toBeEmptyDOMElement()
    })

    it('renders banner and enables notifications', async () => {
        const user = userEvent.setup()
        const setDismissed = vi.fn()
        const requestPermission = vi.fn().mockResolvedValue('granted')
        mockUsePushNotifications.mockReturnValue({
            isSupported: true,
            settings: { permission: 'default' },
            requestPermission,
        })
        mockUseKV.mockReturnValue([false, setDismissed])

        render(<NotificationPermissionBanner />)

        expect(await screen.findByText(/enable desktop notifications/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /enable/i }))

        await waitFor(() => {
            expect(requestPermission).toHaveBeenCalledOnce()
            expect(setDismissed).toHaveBeenCalledWith(true)
        })
    })

    it('dismisses banner from maybe later action', async () => {
        const user = userEvent.setup()
        const setDismissed = vi.fn()
        const requestPermission = vi.fn()
        mockUsePushNotifications.mockReturnValue({
            isSupported: true,
            settings: { permission: 'default' },
            requestPermission,
        })
        mockUseKV.mockReturnValue([false, setDismissed])

        render(<NotificationPermissionBanner />)

        expect(await screen.findByText(/enable desktop notifications/i)).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: /maybe later/i }))

        expect(requestPermission).not.toHaveBeenCalled()
        expect(setDismissed).toHaveBeenCalledWith(true)
    })

    it('dismisses banner when requestPermission rejects without propagating an error', async () => {
        const user = userEvent.setup()
        const setDismissed = vi.fn()
        const requestPermission = vi.fn().mockRejectedValue(new Error('permission-failure'))
        mockUsePushNotifications.mockReturnValue({
            isSupported: true,
            settings: { permission: 'default' },
            requestPermission,
        })
        mockUseKV.mockReturnValue([false, setDismissed])

        render(<NotificationPermissionBanner />)

        await user.click(await screen.findByRole('button', { name: /enable/i }))

        await waitFor(() => {
            expect(requestPermission).toHaveBeenCalledOnce()
            expect(setDismissed).toHaveBeenCalledWith(true)
        })
    })

    it('dismisses banner when requestPermission resolves to denied', async () => {
        const user = userEvent.setup()
        const setDismissed = vi.fn()
        const requestPermission = vi.fn().mockResolvedValue('denied')
        mockUsePushNotifications.mockReturnValue({
            isSupported: true,
            settings: { permission: 'default' },
            requestPermission,
        })
        mockUseKV.mockReturnValue([false, setDismissed])

        render(<NotificationPermissionBanner />)

        await user.click(await screen.findByRole('button', { name: /enable/i }))

        await waitFor(() => {
            expect(requestPermission).toHaveBeenCalledOnce()
            expect(setDismissed).toHaveBeenCalledWith(true)
        })
    })
})
