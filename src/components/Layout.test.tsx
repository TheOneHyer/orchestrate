import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Layout } from './Layout'
import type { User } from '@/lib/types'

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

const adminUser: User = {
    id: 'admin-1',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    department: 'Administration',
    certifications: [],
    hireDate: '2025-01-01',
}

const trainerUser: User = {
    id: 'trainer-1',
    name: 'Trainer One',
    email: 'trainer@example.com',
    role: 'trainer',
    department: 'Training',
    certifications: [],
    hireDate: '2025-01-01',
}

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

    it('renders accessibility landmarks and skip link', () => {
        render(
            <Layout activeView="dashboard" onNavigate={vi.fn()} userRole="admin" notificationCount={0}>
                <div>Page Content</div>
            </Layout>
        )

        expect(screen.getByRole('navigation', { name: /primary navigation/i })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /skip to main content/i })).toBeInTheDocument()
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
        expect(notificationsButton).toHaveClass('bg-primary')

        rerender(
            <Layout activeView="settings" onNavigate={vi.fn()} userRole="admin" notificationCount={2}>
                <div>Page Content</div>
            </Layout>
        )

        const settingsButton = screen.getByRole('button', { name: /^settings$/i })
        expect(settingsButton).toHaveClass('bg-primary')
        expect(notificationsButton).not.toHaveClass('bg-primary')
    })

    it('renders different theme icons for dark and light themes', () => {
        mockUseTheme.mockReturnValue({ theme: 'dark', toggleTheme: mockToggleTheme })

        const { rerender } = render(
            <Layout activeView="dashboard" onNavigate={vi.fn()} userRole="trainer">
                <div>Page Content</div>
            </Layout>
        )

        expect(screen.getByTestId('theme-icon-sun')).toBeInTheDocument()

        mockUseTheme.mockReturnValue({ theme: 'light', toggleTheme: mockToggleTheme })
        rerender(
            <Layout activeView="dashboard" onNavigate={vi.fn()} userRole="trainer">
                <div>Page Content</div>
            </Layout>
        )

        expect(screen.getByTestId('theme-icon-moon')).toBeInTheDocument()
    })

    it('opens the active session menu and switches users or resets the session', async () => {
        const onSwitchUser = vi.fn()
        const onLogout = vi.fn()

        render(
            <Layout
                activeView="dashboard"
                onNavigate={vi.fn()}
                userRole="admin"
                currentUser={adminUser}
                users={[adminUser, trainerUser]}
                onSwitchUser={onSwitchUser}
                onLogout={onLogout}
            >
                <div>Page Content</div>
            </Layout>
        )

        await userEvent.click(screen.getByRole('button', { name: /open active user menu/i }))

        expect(screen.getByText(/active session/i)).toBeInTheDocument()
        expect(screen.getByText(/switch roles locally/i)).toBeInTheDocument()
        expect(screen.getByText(/trainer one/i)).toBeInTheDocument()

        await userEvent.click(screen.getByText('Trainer One'))
        expect(onSwitchUser).toHaveBeenCalledWith('trainer-1')

        await userEvent.click(screen.getByRole('button', { name: /open active user menu/i }))
        const menu = screen.getByRole('menu')
        await userEvent.click(within(menu).getByRole('menuitem', { name: /reset session/i }))
        expect(onLogout).toHaveBeenCalledOnce()
    })

    it('falls back to the current employee as the only switchable user and uses outline role badges', async () => {
        render(
            <Layout
                activeView="dashboard"
                onNavigate={vi.fn()}
                userRole="employee"
                currentUser={{ ...trainerUser, id: 'employee-1', name: 'Employee One', role: 'employee', email: 'employee@example.com' }}
                users={[]}
                onSwitchUser={vi.fn()}
            >
                <div>Page Content</div>
            </Layout>
        )

        await userEvent.click(screen.getByRole('button', { name: /open active user menu/i }))

        expect(screen.getAllByText(/employee one/i)).toHaveLength(2)
        expect(screen.getAllByText(/employee/i).length).toBeGreaterThan(0)
        expect(screen.getByText(/^active$/i)).toBeInTheDocument()
    })

    it('renders the trainer session badge variant when the current user is a trainer', async () => {
        render(
            <Layout
                activeView="dashboard"
                onNavigate={vi.fn()}
                userRole="trainer"
                currentUser={trainerUser}
                users={[]}
                onSwitchUser={vi.fn()}
            >
                <div>Page Content</div>
            </Layout>
        )

        await userEvent.click(screen.getByRole('button', { name: /open active user menu/i }))

        expect(screen.getAllByText(/trainer/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/trainer one/i)).toHaveLength(2)
    })
})
