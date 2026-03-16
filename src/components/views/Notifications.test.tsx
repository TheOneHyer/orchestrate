import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

describe('Notifications', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-16T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

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

  it('marks unread items as read and navigates when a linked notification is clicked', () => {
    const onMarkAsRead = vi.fn()
    const onNavigate = vi.fn()

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

    fireEvent.click(screen.getByText(/session reminder/i))

    expect(onMarkAsRead).toHaveBeenCalledWith('n-1')
    expect(onNavigate).toHaveBeenCalledWith('schedule')
  })

  it('supports mark-all and clear flows', () => {
    const onMarkAllAsRead = vi.fn()
    const onDismissAll = vi.fn()

    const notifications: Notification[] = [
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

    render(
      <Notifications
        notifications={notifications}
        onMarkAsRead={vi.fn()}
        onMarkAsUnread={vi.fn()}
        onMarkAllAsRead={onMarkAllAsRead}
        onDismiss={vi.fn()}
        onDismissAll={onDismissAll}
        onNavigate={vi.fn()}
      />
    )

    // Single click calls onMarkAllAsRead directly
    fireEvent.click(screen.getByRole('button', { name: /mark all read/i }))
    expect(onMarkAllAsRead).toHaveBeenCalledOnce()

    // First click opens the confirmation, second click confirms the action
    fireEvent.click(screen.getByRole('button', { name: /clear read/i }))
    fireEvent.click(screen.getByRole('button', { name: /^clear read$/i }))
    expect(onDismissAll).toHaveBeenCalledWith('read')

    // First click opens the confirmation, second click confirms the action
    fireEvent.click(screen.getByRole('button', { name: /^clear all$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^clear all$/i }))
    expect(onDismissAll).toHaveBeenCalledWith('all')
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
