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
})
