import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Layout } from './Layout'

const mockToggleTheme = vi.fn()
const mockUseTheme = vi.fn()

vi.mock('@/hooks/use-theme', () => ({
    useTheme: () => mockUseTheme(),
}))

vi.mock('@/components/NotificationSettingsDialog', () => ({
    NotificationSettingsDialog: ({ open, onOpenChange }: { open: boolean, onOpenChange?: (open: boolean) => void }) => (
        <div data-testid="notification-settings-dialog" data-open={String(open)}>
            Notification Settings Dialog
            {onOpenChange && (
                <button data-testid="notification-settings-dialog-toggle" onClick={() => onOpenChange(false)}>
                    Close Dialog
                </button>
            )}
        </div>
    ),
}))

describe('Layout', () => {
    beforeEach(() => {
        mockToggleTheme.mockReset()
        mockUseTheme.mockReset()
        mockUseTheme.mockReturnValue({ theme: 'light', toggleTheme: mockToggleTheme })
    })

    it('filters navigation by role and shows admin settings', () => {
        const onNavigate = vi.fn()
        render(
            <Layout activeView="dashboard" onNavigate={onNavigate} userRole="admin" notificationCount={3}>
                <div>Page Content</div>
            </Layout>
        )

        expect(screen.getByText(/schedule templates/i)).toBeInTheDocument()
        expect(screen.getByText(/burnout risk/i)).toBeInTheDocument()
        expect(screen.getByText(/wellness & recovery/i)).toBeInTheDocument()
        expect(screen.getByText(/^settings$/i)).toBeInTheDocument()
    })

    it('shows notification count', () => {
        const onNavigate = vi.fn()
        render(
            <Layout activeView="dashboard" onNavigate={onNavigate} userRole="admin" notificationCount={3}>
                <div>Page Content</div>
            </Layout>
        )

        expect(screen.getByTestId('notification-count')).toHaveTextContent('3')
    })

    it('hides admin-only items for employees', () => {
        const onNavigate = vi.fn()
        render(
            <Layout activeView="dashboard" onNavigate={onNavigate} userRole="employee" notificationCount={0}>
                <div>Page Content</div>
            </Layout>
        )

        expect(screen.queryByText(/schedule templates/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/^settings$/i)).not.toBeInTheDocument()
    })

    it('navigates on notifications button click', async () => {
        const onNavigate = vi.fn()
        render(
            <Layout activeView="dashboard" onNavigate={onNavigate} userRole="employee" notificationCount={0}>
                <div>Page Content</div>
            </Layout>
        )

        await userEvent.click(screen.getByRole('button', { name: /notifications/i }))
        expect(onNavigate).toHaveBeenCalledWith('notifications')
    })

    it('opens and closes notification settings dialog from header actions', async () => {
        render(
            <Layout activeView="dashboard" onNavigate={vi.fn()} userRole="trainer">
                <div>Page Content</div>
            </Layout>
        )

        expect(screen.getByTestId('notification-settings-dialog')).toHaveAttribute('data-open', 'false')

        await userEvent.click(screen.getByRole('button', { name: /notification settings/i }))
        expect(screen.getByTestId('notification-settings-dialog')).toHaveAttribute('data-open', 'true')

        // Close dialog via mock button
        await userEvent.click(screen.getByTestId('notification-settings-dialog-toggle'))
        expect(screen.getByTestId('notification-settings-dialog')).toHaveAttribute('data-open', 'false')
    })

    it('toggles theme from header action', async () => {
        render(
            <Layout activeView="dashboard" onNavigate={vi.fn()} userRole="trainer">
                <div>Page Content</div>
            </Layout>
        )

        await userEvent.click(screen.getByRole('button', { name: /toggle theme/i }))
        expect(mockToggleTheme).toHaveBeenCalledOnce()
    })

    it('calls onNavigate with item id when a nav item is clicked', async () => {
        const onNavigate = vi.fn()
        render(
            <Layout activeView="dashboard" onNavigate={onNavigate} userRole="admin" notificationCount={0}>
                <div>Page Content</div>
            </Layout>
        )

        await userEvent.click(screen.getByRole('button', { name: /burnout risk/i }))
        expect(onNavigate).toHaveBeenCalledWith('burnout-dashboard')
    })

    it('calls onNavigate with settings when settings button is clicked', async () => {
        const onNavigate = vi.fn()
        render(
            <Layout activeView="dashboard" onNavigate={onNavigate} userRole="admin" notificationCount={0}>
                <div>Page Content</div>
            </Layout>
        )

        await userEvent.click(screen.getByRole('button', { name: /^settings$/i }))
        expect(onNavigate).toHaveBeenCalledWith('settings')
    })

    it('applies active styles for notifications and settings views', () => {
        const { rerender } = render(
            <Layout activeView="notifications" onNavigate={vi.fn()} userRole="admin" notificationCount={2}>
                <div>Page Content</div>
            </Layout>
        )

        const notificationsButton = screen.getByRole('button', { name: /notifications/i })
        expect(notificationsButton.className).toContain('bg-primary')

        rerender(
            <Layout activeView="settings" onNavigate={vi.fn()} userRole="admin" notificationCount={2}>
                <div>Page Content</div>
            </Layout>
        )

        const settingsButton = screen.getByRole('button', { name: /^settings$/i })
        expect(settingsButton.className).toContain('bg-primary')
    })

    it('renders the dark-theme icon variant when theme is dark', () => {
        mockUseTheme.mockReturnValue({ theme: 'dark', toggleTheme: mockToggleTheme })

        const { rerender } = render(
            <Layout activeView="dashboard" onNavigate={vi.fn()} userRole="trainer">
                <div>Page Content</div>
            </Layout>
        )

        const darkIconPath = screen.getByRole('button', { name: /toggle theme/i })
            .querySelector('path')
            ?.getAttribute('d')

        mockUseTheme.mockReturnValue({ theme: 'light', toggleTheme: mockToggleTheme })
        rerender(
            <Layout activeView="dashboard" onNavigate={vi.fn()} userRole="trainer">
                <div>Page Content</div>
            </Layout>
        )

        const lightIconPath = screen.getByRole('button', { name: /toggle theme/i })
            .querySelector('path')
            ?.getAttribute('d')

        expect(darkIconPath).toBeTruthy()
        expect(lightIconPath).toBeTruthy()
        expect(darkIconPath).not.toBe(lightIconPath)
    })
})
