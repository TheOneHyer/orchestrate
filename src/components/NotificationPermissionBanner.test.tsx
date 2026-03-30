import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

        expect(mockUseKV).toHaveBeenCalledWith('notification-banner-dismissed', false)
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
        await waitFor(() => {
            expect(setDismissed).toHaveBeenCalledWith(true)
        })
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

    it('keeps the banner visible when permission remains default after requesting', async () => {
        const user = userEvent.setup()
        const setDismissed = vi.fn()
        const requestPermission = vi.fn().mockResolvedValue('default')

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
            expect(screen.getByRole('button', { name: /enable/i })).toBeInTheDocument()
        })

        expect(setDismissed).not.toHaveBeenCalled()
        expect(screen.getByText(/enable desktop notifications/i)).toBeInTheDocument()
    })

    it('does not trigger a duplicate permission request while one is in flight', async () => {
        const user = userEvent.setup()
        const setDismissed = vi.fn()
        let resolvePermission!: (value: NotificationPermission) => void
        const requestPermission = vi.fn(
            () => new Promise<NotificationPermission>((resolve) => { resolvePermission = resolve })
        )

        mockUsePushNotifications.mockReturnValue({
            isSupported: true,
            settings: { permission: 'default' },
            requestPermission,
        })
        mockUseKV.mockReturnValue([false, setDismissed])

        render(<NotificationPermissionBanner />)

        const enableButton = await screen.findByRole('button', { name: /enable/i })
        await user.click(enableButton)
        await user.click(enableButton)

        expect(requestPermission).toHaveBeenCalledTimes(1)

        resolvePermission('granted')
        await waitFor(() => {
            expect(setDismissed).toHaveBeenCalledWith(true)
        })
    })

    it('returns early when enable is triggered again while a request is already pending', async () => {
        const setDismissed = vi.fn()
        let resolvePermission!: (value: NotificationPermission) => void
        const requestPermission = vi.fn(
            () => new Promise<NotificationPermission>((resolve) => { resolvePermission = resolve })
        )

        mockUsePushNotifications.mockReturnValue({
            isSupported: true,
            settings: { permission: 'default' },
            requestPermission,
        })
        mockUseKV.mockReturnValue([false, setDismissed])

        render(<NotificationPermissionBanner />)

        const enableButton = await screen.findByRole('button', { name: /enable/i })
        fireEvent.click(enableButton)
        expect(enableButton).toBeDisabled()
        // Re-enable the DOM node so we can invoke the click handler while state is still requesting.
        enableButton.removeAttribute('disabled')
        fireEvent.click(enableButton)

        expect(requestPermission).toHaveBeenCalledTimes(1)

        resolvePermission('granted')
        await waitFor(() => {
            expect(setDismissed).toHaveBeenCalledWith(true)
        })
    })

    it('does not update banner state when permission resolves after unmount', async () => {
        const user = userEvent.setup()
        const setDismissed = vi.fn()
        let resolvePermission!: (value: NotificationPermission) => void
        const requestPermission = vi.fn(
            () => new Promise<NotificationPermission>((resolve) => { resolvePermission = resolve })
        )

        mockUsePushNotifications.mockReturnValue({
            isSupported: true,
            settings: { permission: 'default' },
            requestPermission,
        })
        mockUseKV.mockReturnValue([false, setDismissed])

        const { unmount } = render(<NotificationPermissionBanner />)

        await user.click(await screen.findByRole('button', { name: /enable/i }))
        unmount()

        resolvePermission('granted')
        await act(async () => {
            await Promise.resolve()
        })

        expect(setDismissed).not.toHaveBeenCalled()
    })

    it('does not update banner state when permission rejects after unmount', async () => {
        const user = userEvent.setup()
        const setDismissed = vi.fn()
        let rejectPermission!: (reason?: unknown) => void
        const requestPermission = vi.fn(
            () => new Promise<NotificationPermission>((_, reject) => { rejectPermission = reject })
        )
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

        try {
            mockUsePushNotifications.mockReturnValue({
                isSupported: true,
                settings: { permission: 'default' },
                requestPermission,
            })
            mockUseKV.mockReturnValue([false, setDismissed])

            const { unmount } = render(<NotificationPermissionBanner />)

            await user.click(await screen.findByRole('button', { name: /enable/i }))
            unmount()

            rejectPermission(new Error('permission-failure-after-unmount'))
            await act(async () => {
                await Promise.resolve()
            })

            expect(setDismissed).not.toHaveBeenCalled()
        } finally {
            consoleErrorSpy.mockRestore()
        }
    })
})
