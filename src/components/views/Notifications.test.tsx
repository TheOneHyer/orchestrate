import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Notifications } from './Notifications'
import type { Notification } from '@/lib/types'

const baseNotification: Notification = {
  id: 'n-1',
  userId: 'u-1',
  type: 'session',
  title: 'Session Reminder',
  message: 'Upcoming session starts soon',
  link: 'schedule',
  read: false,
  createdAt: '2026-03-16T12:00:00.000Z',
  priority: 'high',
}

const twoNotifications: Notification[] = [
  baseNotification,
  {
    ...baseNotification,
    id: 'n-2',
    title: 'Read message',
    read: true,
    type: 'system',
    priority: 'low',
  },
]

describe('Notifications', () => {
  it('renders empty state when there are no notifications', () => {
    render(
      <Notifications
        notifications={[]}
        onMarkAsRead={vi.fn()}
        onMarkAsUnread={vi.fn()}
        onMarkAllAsRead={vi.fn()}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByText(/all caught up!/i)).toBeInTheDocument()
    expect(screen.getByText(/you don't have any notifications right now/i)).toBeInTheDocument()
  })

  it('marks unread items as read and navigates when a linked notification is clicked', async () => {
    const onMarkAsRead = vi.fn()
    const onNavigate = vi.fn()
    const user = userEvent.setup()

    render(
      <Notifications
        notifications={[baseNotification]}
        onMarkAsRead={onMarkAsRead}
        onMarkAsUnread={vi.fn()}
        onMarkAllAsRead={vi.fn()}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        onNavigate={onNavigate}
      />
    )

    await user.click(screen.getByText(/session reminder/i))

    expect(onMarkAsRead).toHaveBeenCalledWith('n-1')
    expect(onMarkAsRead).toHaveBeenCalledTimes(1)
    expect(onNavigate).toHaveBeenCalledWith('schedule')
    expect(onNavigate).toHaveBeenCalledTimes(1)
  })

  it('marks all notifications as read', async () => {
    const onMarkAllAsRead = vi.fn()
    const user = userEvent.setup()

    render(
      <Notifications
        notifications={twoNotifications}
        onMarkAsRead={vi.fn()}
        onMarkAsUnread={vi.fn()}
        onMarkAllAsRead={onMarkAllAsRead}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /mark all read/i }))
    expect(onMarkAllAsRead).toHaveBeenCalledOnce()
  })

  it('clears read notifications after confirmation', async () => {
    const onDismissAll = vi.fn()
    const user = userEvent.setup()

    render(
      <Notifications
        notifications={twoNotifications}
        onMarkAsRead={vi.fn()}
        onMarkAsUnread={vi.fn()}
        onMarkAllAsRead={vi.fn()}
        onDismiss={vi.fn()}
        onDismissAll={onDismissAll}
        onNavigate={vi.fn()}
      />
    )

    // The Notifications component requires two clicks on "Clear Read" to confirm: the first click
    // opens a confirmation dialog, and the second click (on the same button inside the dialog) confirms.
    await user.click(screen.getByRole('button', { name: /^clear read$/i }))
    expect(onDismissAll).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /^clear read$/i }))
    expect(onDismissAll).toHaveBeenCalledWith('read')
  })

  it('clears all notifications after confirmation', async () => {
    const onDismissAll = vi.fn()
    const user = userEvent.setup()

    render(
      <Notifications
        notifications={twoNotifications}
        onMarkAsRead={vi.fn()}
        onMarkAsUnread={vi.fn()}
        onMarkAllAsRead={vi.fn()}
        onDismiss={vi.fn()}
        onDismissAll={onDismissAll}
        onNavigate={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /^clear all$/i }))
    expect(onDismissAll).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /^clear all$/i }))
    expect(onDismissAll).toHaveBeenCalledWith('all')
  })

  it('marks a read notification as unread', async () => {
    const onMarkAsUnread = vi.fn()
    const user = userEvent.setup()

    render(
      <Notifications
        notifications={[
          {
            ...baseNotification,
            id: 'n-2',
            title: 'Read message',
            read: true,
          },
        ]}
        onMarkAsRead={vi.fn()}
        onMarkAsUnread={onMarkAsUnread}
        onMarkAllAsRead={vi.fn()}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /mark read message as unread/i }))

    expect(onMarkAsUnread).toHaveBeenCalledWith('n-2')
  })

  it('dismisses a single notification entry', async () => {
    const onDismiss = vi.fn()
    const user = userEvent.setup()

    render(
      <Notifications
        notifications={[baseNotification]}
        onMarkAsRead={vi.fn()}
        onMarkAsUnread={vi.fn()}
        onMarkAllAsRead={vi.fn()}
        onDismiss={onDismiss}
        onDismissAll={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /dismiss session reminder/i }))

    expect(onDismiss).toHaveBeenCalledWith('n-1')
  })

  it('renders category tabs and notification entries', () => {
    const notifications: Notification[] = [
      baseNotification,
      {
        ...baseNotification,
        id: 'n-2',
        title: 'Already read',
        type: 'system',
        read: true,
        priority: 'low',
      },
    ]

    render(
      <Notifications
        notifications={notifications}
        onMarkAsRead={vi.fn()}
        onMarkAsUnread={vi.fn()}
        onMarkAllAsRead={vi.fn()}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByText(/session reminder/i)).toBeInTheDocument()
    expect(screen.getByText(/already read/i)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^all/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^unread/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^read/i })).toBeInTheDocument()
  })

  it('filters notifications by selected tab', async () => {
    const user = userEvent.setup()

    render(
      <Notifications
        notifications={twoNotifications}
        onMarkAsRead={vi.fn()}
        onMarkAsUnread={vi.fn()}
        onMarkAllAsRead={vi.fn()}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    await user.click(screen.getByRole('tab', { name: /^unread/i }))

    expect(screen.getByText(/session reminder/i)).toBeInTheDocument()
    expect(screen.queryByText(/read message/i)).not.toBeInTheDocument()
  })
  it('handles notifications with different types', async () => {
    const user = userEvent.setup()

    const notifications: Notification[] = [
      { ...baseNotification, id: 'n-1', type: 'session', title: 'Session Type' },
      { ...baseNotification, id: 'n-assignment', type: 'assignment', title: 'Assignment Type', read: true },
      { ...baseNotification, id: 'n-2', type: 'system', title: 'System Type', read: true },
      { ...baseNotification, id: 'n-3', type: 'reminder', title: 'Reminder Type', read: true },
      { ...baseNotification, id: 'n-4', type: 'workload', title: 'Workload Type', read: true },
      { ...baseNotification, id: 'n-complete', type: 'completion', title: 'Completion Type', read: true },
    ]

    render(
      <Notifications
        notifications={notifications}
        onMarkAsRead={vi.fn()}
        onMarkAsUnread={vi.fn()}
        onMarkAllAsRead={vi.fn()}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByText('Session Type')).toBeInTheDocument()
    expect(screen.getByText('Assignment Type')).toBeInTheDocument()
    expect(screen.getByText('System Type')).toBeInTheDocument()
    expect(screen.getByText('Reminder Type')).toBeInTheDocument()
    expect(screen.getByText('Workload Type')).toBeInTheDocument()
    expect(screen.getByText('Completion Type')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /^sessions/i }))
    expect(screen.getByText('Session Type')).toBeInTheDocument()
    expect(screen.queryByText('System Type')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /^assignments/i }))
    expect(screen.getByText('Assignment Type')).toBeInTheDocument()
    expect(screen.queryByText('Session Type')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /^system/i }))
    expect(screen.getByText('System Type')).toBeInTheDocument()
    expect(screen.queryByText('Reminder Type')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /^reminders/i }))
    expect(screen.getByText('Reminder Type')).toBeInTheDocument()
    expect(screen.queryByText('Workload Type')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /^workload/i }))
    expect(screen.getByText('Workload Type')).toBeInTheDocument()
    expect(screen.queryByText('Session Type')).not.toBeInTheDocument()
  })

  it('filters notifications by high priority tab', async () => {
    const user = userEvent.setup()

    render(
      <Notifications
        notifications={[
          { ...baseNotification, id: 'n-high', title: 'High Priority Item', priority: 'high' },
          { ...baseNotification, id: 'n-critical', title: 'Critical Item', priority: 'critical', read: true },
          { ...baseNotification, id: 'n-medium', title: 'Medium Item', priority: 'medium', read: true },
        ]}
        onMarkAsRead={vi.fn()}
        onMarkAsUnread={vi.fn()}
        onMarkAllAsRead={vi.fn()}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    await user.click(screen.getByRole('tab', { name: /^priority/i }))

    expect(screen.getByText('High Priority Item')).toBeInTheDocument()
    expect(screen.getByText('Critical Item')).toBeInTheDocument()
    expect(screen.queryByText('Medium Item')).not.toBeInTheDocument()
  })

  it('handles notifications with different priority levels', () => {
    const notifications: Notification[] = [
      { ...baseNotification, id: 'n-1', priority: 'high', title: 'High Priority' },
      { ...baseNotification, id: 'n-2', priority: 'medium', title: 'Medium Priority', read: true },
      { ...baseNotification, id: 'n-3', priority: 'low', title: 'Low Priority', read: true },
    ]

    render(
      <Notifications
        notifications={notifications}
        onMarkAsRead={vi.fn()}
        onMarkAsUnread={vi.fn()}
        onMarkAllAsRead={vi.fn()}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByText('High Priority')).toBeInTheDocument()
    expect(screen.getByText('Medium Priority')).toBeInTheDocument()
    expect(screen.getByText('Low Priority')).toBeInTheDocument()
    expect(screen.getByText(/^High$/)).toBeInTheDocument()
    expect(screen.getByText(/^Medium$/)).toBeInTheDocument()
    expect(screen.queryByText(/^Low$/)).not.toBeInTheDocument()
  })

  it('handles notifications without links', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const onMarkAsRead = vi.fn()
    const notifications: Notification[] = [
      { id: 'n-1', userId: 'u-1', type: 'system', title: 'No Link', message: 'This has no link', read: false, createdAt: '2026-03-16T12:00:00.000Z', priority: 'low' },
    ]

    render(
      <Notifications
        notifications={notifications}
        onMarkAsRead={onMarkAsRead}
        onMarkAsUnread={vi.fn()}
        onMarkAllAsRead={vi.fn()}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        onNavigate={onNavigate}
      />
    )

    expect(screen.getByText(/No Link/)).toBeInTheDocument()

    await user.click(screen.getByText(/No Link/))

    expect(onMarkAsRead).toHaveBeenCalledWith('n-1')
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('handles long notification messages', () => {
    const longMessage = 'A'.repeat(200)
    const notifications: Notification[] = [
      { ...baseNotification, id: 'n-1', message: longMessage, title: 'Long Message Title' },
    ]

    render(
      <Notifications
        notifications={notifications}
        onMarkAsRead={vi.fn()}
        onMarkAsUnread={vi.fn()}
        onMarkAllAsRead={vi.fn()}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByText(/Long Message Title/)).toBeInTheDocument()
    expect(screen.getByText(longMessage)).toBeInTheDocument()
  })

  it('handles large number of notifications', () => {
    const notifications: Notification[] = Array.from({ length: 20 }, (_, idx) => ({
      ...baseNotification,
      id: `n-${idx}`,
      title: `Notification ${idx + 1}`,
      read: false,
      createdAt: `2026-03-${String((idx % 9) + 10).padStart(2, '0')}T12:00:00.000Z`,
    }))

    render(
      <Notifications
        notifications={notifications}
        onMarkAsRead={vi.fn()}
        onMarkAsUnread={vi.fn()}
        onMarkAllAsRead={vi.fn()}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByText(/20 unread • 20 total/i)).toBeInTheDocument()
    expect(screen.getByText('Notification 1')).toBeInTheDocument()
    expect(screen.getByText('Notification 20')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /dismiss notification \d+/i })).toHaveLength(20)
  })

  it('handles notifications with special characters in titles', () => {
    const notifications: Notification[] = [
      { ...baseNotification, id: 'n-1', title: "User O'Brien's Certification & Skills (Updated)" },
    ]

    render(
      <Notifications
        notifications={notifications}
        onMarkAsRead={vi.fn()}
        onMarkAsUnread={vi.fn()}
        onMarkAllAsRead={vi.fn()}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByText(/o'brien's/i)).toBeInTheDocument()
  })

  it('handles all read notifications', async () => {
    const user = userEvent.setup()
    const notifications: Notification[] = [
      { ...baseNotification, id: 'n-1', title: 'Read One', read: true },
      { ...baseNotification, id: 'n-2', title: 'Read Two', read: true },
      { ...baseNotification, id: 'n-3', title: 'Read Three', read: true },
    ]

    render(
      <Notifications
        notifications={notifications}
        onMarkAsRead={vi.fn()}
        onMarkAsUnread={vi.fn()}
        onMarkAllAsRead={vi.fn()}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByText(/0 unread • 3 total/i)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^read/i })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /^unread/i }))

    expect(screen.getByText(/no notifications in this category/i)).toBeInTheDocument()
  })

  it('handles all unread notifications', async () => {
    const user = userEvent.setup()
    const notifications: Notification[] = [
      { ...baseNotification, id: 'n-1', title: 'Unread One', read: false },
      { ...baseNotification, id: 'n-2', title: 'Unread Two', read: false },
      { ...baseNotification, id: 'n-3', title: 'Unread Three', read: false },
    ]

    render(
      <Notifications
        notifications={notifications}
        onMarkAsRead={vi.fn()}
        onMarkAsUnread={vi.fn()}
        onMarkAllAsRead={vi.fn()}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByText(/3 unread • 3 total/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mark all read/i })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /^read/i }))

    expect(screen.getByText(/no notifications in this category/i)).toBeInTheDocument()
  })

  it('renders unread tab and shows count', () => {
    const notifications: Notification[] = [
      { ...baseNotification, id: 'n-1', read: false },
      { ...baseNotification, id: 'n-2', read: false },
      { ...baseNotification, id: 'n-3', read: true },
    ]

    render(
      <Notifications
        notifications={notifications}
        onMarkAsRead={vi.fn()}
        onMarkAsUnread={vi.fn()}
        onMarkAllAsRead={vi.fn()}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByRole('tab', { name: /^unread/i })).toBeInTheDocument()
    expect(screen.getByText(/2 unread • 3 total/i)).toBeInTheDocument()
  })
})
