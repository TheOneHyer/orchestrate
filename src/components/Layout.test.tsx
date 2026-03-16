import { fireEvent, render, screen } from '@testing-library/react'
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
        mockToggleTheme.mockClear()
        mockUseTheme.mockClear()
    })

    it('filters navigation by role and shows admin settings', () => {
        mockUseTheme.mockReturnValue({ theme: 'light', toggleTheme: mockToggleTheme })

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
        expect(screen.getByTestId('notification-count')).toHaveTextContent('3')
    })

    it('hides admin-only items for employees and navigates on click', () => {
        mockUseTheme.mockReturnValue({ theme: 'dark', toggleTheme: mockToggleTheme })

        const onNavigate = vi.fn()
        render(
            <Layout activeView="dashboard" onNavigate={onNavigate} userRole="employee" notificationCount={0}>
                <div>Page Content</div>
            </Layout>
        )

        expect(screen.queryByText(/schedule templates/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/^settings$/i)).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
        expect(onNavigate).toHaveBeenCalledWith('notifications')
    })

    it('opens notification settings dialog and toggles theme from header actions', () => {
        mockUseTheme.mockReturnValue({ theme: 'light', toggleTheme: mockToggleTheme })

        render(
            <Layout activeView="dashboard" onNavigate={vi.fn()} userRole="trainer">
                <div>Page Content</div>
            </Layout>
        )

        expect(screen.getByTestId('notification-settings-dialog')).toHaveAttribute('data-open', 'false')

        fireEvent.click(screen.getByRole('button', { name: /notification settings/i }))
        expect(screen.getByTestId('notification-settings-dialog')).toHaveAttribute('data-open', 'true')

        // Close dialog via mock button
        fireEvent.click(screen.getByTestId('notification-settings-dialog-toggle'))
        expect(screen.getByTestId('notification-settings-dialog')).toHaveAttribute('data-open', 'false')

        fireEvent.click(screen.getByRole('button', { name: /toggle theme/i }))
        expect(mockToggleTheme).toHaveBeenCalledOnce()
    })
})
