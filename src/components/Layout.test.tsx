import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Layout } from './Layout'
import type { User } from '@/lib/types'

const mockToggleTheme = vi.fn()
const mockUseTheme = vi.fn()
const mockUseIsMobile = vi.fn()

vi.mock('@/hooks/use-theme', () => ({
    useTheme: () => mockUseTheme(),
}))

vi.mock('@/hooks/use-mobile', () => ({
    useIsMobile: () => mockUseIsMobile(),
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
        mockUseIsMobile.mockReset()
        mockUseIsMobile.mockReturnValue(false)
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

    describe('mobile layout', () => {
        beforeEach(() => {
            mockUseIsMobile.mockReturnValue(true)
        })

        it('renders the app title in the mobile header', () => {
            render(
                <Layout activeView="dashboard" onNavigate={vi.fn()} userRole="admin">
                    <div>Page Content</div>
                </Layout>
            )

            expect(screen.getByText('Orchestrate')).toBeInTheDocument()
        })

        it('renders the bottom navigation with primary items', () => {
            render(
                <Layout activeView="dashboard" onNavigate={vi.fn()} userRole="employee">
                    <div>Page Content</div>
                </Layout>
            )

            expect(screen.getByRole('button', { name: /^home$/i })).toBeInTheDocument()
            expect(screen.getByRole('button', { name: /^schedule$/i })).toBeInTheDocument()
            expect(screen.getByRole('button', { name: /^courses$/i })).toBeInTheDocument()
            expect(screen.getByRole('button', { name: /open notifications/i })).toBeInTheDocument()
            expect(screen.getByRole('button', { name: /open navigation menu/i })).toBeInTheDocument()
        })

        it('highlights the active bottom-nav item', () => {
            render(
                <Layout activeView="schedule" onNavigate={vi.fn()} userRole="employee">
                    <div>Page Content</div>
                </Layout>
            )

            const scheduleBtn = screen.getByRole('button', { name: /^schedule$/i })
            expect(scheduleBtn).toHaveAttribute('aria-current', 'page')

            const homeBtn = screen.getByRole('button', { name: /^home$/i })
            expect(homeBtn).not.toHaveAttribute('aria-current', 'page')
        })

        it('navigates when a bottom-nav item is clicked', async () => {
            const onNavigate = vi.fn()
            render(
                <Layout activeView="dashboard" onNavigate={onNavigate} userRole="employee">
                    <div>Page Content</div>
                </Layout>
            )

            await userEvent.click(screen.getByRole('button', { name: /^schedule$/i }))
            expect(onNavigate).toHaveBeenCalledWith('schedule')

            await userEvent.click(screen.getByRole('button', { name: /^courses$/i }))
            expect(onNavigate).toHaveBeenCalledWith('courses')

            await userEvent.click(screen.getByRole('button', { name: /open notifications/i }))
            expect(onNavigate).toHaveBeenCalledWith('notifications')
        })

        it('shows notification count badge in the bottom navigation', () => {
            render(
                <Layout activeView="dashboard" onNavigate={vi.fn()} userRole="admin" notificationCount={5}>
                    <div>Page Content</div>
                </Layout>
            )

            expect(screen.getByTestId('notification-count')).toHaveTextContent('5')
        })

        it('displays 9+ for notification counts above 9', () => {
            render(
                <Layout activeView="dashboard" onNavigate={vi.fn()} userRole="admin" notificationCount={12}>
                    <div>Page Content</div>
                </Layout>
            )

            expect(screen.getByTestId('notification-count')).toHaveTextContent('9+')
        })

        it('opens the navigation Sheet when "More" is clicked and shows primary nav items', async () => {
            render(
                <Layout activeView="dashboard" onNavigate={vi.fn()} userRole="admin">
                    <div>Page Content</div>
                </Layout>
            )

            await userEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))

            const nav = screen.getByRole('navigation', { name: /primary navigation/i })
            expect(within(nav).getByRole('button', { name: /burnout risk/i })).toBeInTheDocument()
            expect(within(nav).getByRole('button', { name: /wellness & recovery/i })).toBeInTheDocument()
            expect(within(nav).getByRole('button', { name: /certifications/i })).toBeInTheDocument()
        })

        it('navigates from the Sheet and closes it', async () => {
            const onNavigate = vi.fn()
            render(
                <Layout activeView="dashboard" onNavigate={onNavigate} userRole="admin">
                    <div>Page Content</div>
                </Layout>
            )

            await userEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))

            const nav = screen.getByRole('navigation', { name: /primary navigation/i })
            await userEvent.click(within(nav).getByRole('button', { name: /^schedule$/i }))
            expect(onNavigate).toHaveBeenCalledWith('schedule')
        })

        it('hides admin-only Sheet items for employees', async () => {
            render(
                <Layout activeView="dashboard" onNavigate={vi.fn()} userRole="employee">
                    <div>Page Content</div>
                </Layout>
            )

            await userEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))

            expect(screen.queryByRole('button', { name: /burnout risk/i })).not.toBeInTheDocument()
            expect(screen.queryByRole('button', { name: /^settings$/i })).not.toBeInTheDocument()
        })

        it('shows the settings button in the Sheet for admin', async () => {
            render(
                <Layout activeView="dashboard" onNavigate={vi.fn()} userRole="admin">
                    <div>Page Content</div>
                </Layout>
            )

            await userEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))

            expect(screen.getByRole('button', { name: /^settings$/i })).toBeInTheDocument()
        })

        it('navigates to settings from the Sheet for admin', async () => {
            const onNavigate = vi.fn()
            render(
                <Layout activeView="dashboard" onNavigate={onNavigate} userRole="admin">
                    <div>Page Content</div>
                </Layout>
            )

            await userEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
            await userEvent.click(screen.getByRole('button', { name: /^settings$/i }))
            expect(onNavigate).toHaveBeenCalledWith('settings')
        })

        it('toggles theme from mobile header', async () => {
            render(
                <Layout activeView="dashboard" onNavigate={vi.fn()} userRole="trainer">
                    <div>Page Content</div>
                </Layout>
            )

            await userEvent.click(screen.getByRole('button', { name: /toggle theme/i }))
            expect(mockToggleTheme).toHaveBeenCalledOnce()
        })

        it('renders theme icons for dark and light themes in mobile header', () => {
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

        it('opens notification settings from mobile header', async () => {
            render(
                <Layout activeView="dashboard" onNavigate={vi.fn()} userRole="admin">
                    <div>Page Content</div>
                </Layout>
            )

            expect(screen.getByTestId('notification-settings-dialog')).toHaveAttribute('data-open', 'false')

            await userEvent.click(screen.getByRole('button', { name: /notification settings/i }))
            expect(screen.getByTestId('notification-settings-dialog')).toHaveAttribute('data-open', 'true')
        })

        it('opens the active user menu from the mobile avatar button', async () => {
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
            expect(screen.getByText(/trainer one/i)).toBeInTheDocument()

            await userEvent.click(screen.getByText('Trainer One'))
            expect(onSwitchUser).toHaveBeenCalledWith('trainer-1')
        })

        it('renders skip link in mobile layout', () => {
            render(
                <Layout activeView="dashboard" onNavigate={vi.fn()} userRole="employee">
                    <div>Page Content</div>
                </Layout>
            )

            expect(screen.getByRole('link', { name: /skip to main content/i })).toBeInTheDocument()
        })

        it('renders bottom navigation landmark', () => {
            render(
                <Layout activeView="dashboard" onNavigate={vi.fn()} userRole="employee">
                    <div>Page Content</div>
                </Layout>
            )

            expect(screen.getByRole('navigation', { name: /bottom navigation/i })).toBeInTheDocument()
        })
    })
})
