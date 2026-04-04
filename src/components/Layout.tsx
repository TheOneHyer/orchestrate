import { ReactNode, useState } from 'react'
import {
  House,
  CalendarDots,
  GraduationCap,
  Users,
  ChartBar,
  Bell,
  Gear,
  Calendar,
  Heart,
  Repeat,
  Moon,
  Sun,
  Certificate,
  SpeakerHigh,
  BookOpen,
  SignOut,
  CaretDown,
  List,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/use-theme'
import { useIsMobile } from '@/hooks/use-mobile'
import { NotificationSettingsDialog } from '@/components/NotificationSettingsDialog'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { User } from '@/lib/types'

/**
 * Props for the {@link Layout} component.
 */
interface LayoutProps {
  /** Page content rendered inside the main scrollable area. */
  children: ReactNode
  /** The ID of the currently active navigation view, used to highlight the active nav item. */
  activeView: string
  /**
   * Callback invoked when the user clicks a navigation item.
   * @param view - The ID of the destination view.
   */
  onNavigate: (view: string) => void
  /** Number of unread notifications; displayed as a badge on the Notifications nav item. Defaults to 0. */
  notificationCount?: number
  /** Role of the currently signed-in user; controls which nav items are rendered. */
  userRole: 'admin' | 'trainer' | 'employee'
  /** The active user shown in the header. */
  currentUser?: User
  /** All available users that can be switched to locally. */
  users?: User[]
  /** Callback invoked when the user selects another active user. */
  onSwitchUser?: (userId: string) => void
  /** Callback invoked when the user signs out of the local session simulation. */
  onLogout?: () => void
}

/**
 * Root application layout component.
 *
 * Renders an adaptive layout for desktop and mobile viewports:
 * - **Desktop (≥768 px):** Fixed left sidebar with role-filtered navigation items, and a top
 *   header with theme-toggle and notification-settings controls.
 * - **Mobile (<768 px):** Compact top header with app branding and user controls, a scrollable
 *   main content area, a persistent bottom navigation bar for primary destinations, and a
 *   full-navigation Sheet drawer accessible via the "More" button.
 *
 * Role-based filtering ensures admins see all nav items while trainers and employees see only
 * the views relevant to them.
 */
export function Layout({ children, activeView, onNavigate, notificationCount = 0, userRole, currentUser, users = [], onSwitchUser, onLogout }: LayoutProps) {
  const { theme, toggleTheme } = useTheme()
  const isMobile = useIsMobile()
  const [showNotificationSettings, setShowNotificationSettings] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: House, roles: ['admin', 'trainer', 'employee'] },
    { id: 'schedule', label: 'Schedule', icon: CalendarDots, roles: ['admin', 'trainer', 'employee'] },
    { id: 'schedule-templates', label: 'Schedule Templates', icon: Repeat, roles: ['admin', 'trainer'] },
    { id: 'trainer-availability', label: 'Trainer Availability', icon: Calendar, roles: ['admin', 'trainer'] },
    { id: 'certifications', label: 'Certifications', icon: Certificate, roles: ['admin'] },
    { id: 'burnout-dashboard', label: 'Burnout Risk', icon: Heart, roles: ['admin'] },
    { id: 'trainer-wellness', label: 'Wellness & Recovery', icon: Heart, roles: ['admin'] },
    { id: 'courses', label: 'Courses', icon: GraduationCap, roles: ['admin', 'trainer', 'employee'] },
    { id: 'people', label: 'People', icon: Users, roles: ['admin', 'trainer'] },
    { id: 'analytics', label: 'Analytics', icon: ChartBar, roles: ['admin', 'trainer'] },
    { id: 'user-guide', label: 'User Guide', icon: BookOpen, roles: ['admin', 'trainer', 'employee'] },
  ]

  const filteredNavItems = navItems.filter(item => item.roles.includes(userRole))
  const switchableUsers = users.length > 0 ? users : currentUser ? [currentUser] : []
  const currentUserInitials = currentUser
    ? currentUser.name.split(' ').map((namePart) => namePart[0]).join('').slice(0, 2).toUpperCase()
    : 'NA'

  /** Shared user-switcher dropdown content rendered in both desktop and mobile headers. */
  const userDropdownContent = currentUser ? (
    <DropdownMenuContent align="end" className="w-72">
      <DropdownMenuLabel>Active Session</DropdownMenuLabel>
      <div className="px-2 pb-2 text-xs text-muted-foreground">
        Switch roles locally to validate permission-scoped workflows.
      </div>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Switch User</DropdownMenuLabel>
      {switchableUsers.map((userOption) => (
        <DropdownMenuItem
          key={userOption.id}
          onClick={() => onSwitchUser?.(userOption.id)}
          disabled={userOption.id === currentUser.id}
          className="flex items-center justify-between gap-3"
        >
          <span className="flex min-w-0 items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={userOption.avatar} alt={userOption.name} />
              <AvatarFallback className="bg-secondary text-secondary-foreground">
                {userOption.name.split(' ').map((namePart) => namePart[0]).join('').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0">
              <span className="block truncate text-sm">{userOption.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{userOption.department}</span>
            </span>
          </span>
          <span className="flex items-center gap-2">
            {userOption.id === currentUser.id && <Badge variant="secondary">Active</Badge>}
            <Badge variant={userOption.role === 'admin' ? 'default' : userOption.role === 'trainer' ? 'secondary' : 'outline'} className="capitalize">
              {userOption.role}
            </Badge>
          </span>
        </DropdownMenuItem>
      ))}
      {onLogout && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
            <SignOut size={16} className="mr-2" />
            Reset Session
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuContent>
  ) : null

  // ─── Mobile layout ───────────────────────────────────────────────────────────
  if (isMobile) {
    /** Primary bottom-nav destinations available to all roles. */
    const bottomNavItems = [
      { id: 'dashboard', label: 'Home', icon: House },
      { id: 'schedule', label: 'Schedule', icon: CalendarDots },
      { id: 'courses', label: 'Courses', icon: GraduationCap },
    ]

    return (
      <div className="flex h-screen flex-col bg-secondary">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-foreground focus:shadow-md"
        >
          Skip to main content
        </a>

        {/* Mobile header */}
        <header className="shrink-0 border-b border-border bg-card px-4 py-3 flex items-center justify-between">
          <span className="text-lg font-semibold text-primary">Orchestrate</span>
          <div className="flex items-center gap-1">
            {currentUser && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    aria-label="Open active user menu"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {currentUserInitials}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                {userDropdownContent}
              </DropdownMenu>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowNotificationSettings(true)}
              className="rounded-lg"
              title="Notification Settings"
              aria-label="Notification settings"
            >
              <SpeakerHigh size={20} weight="regular" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="rounded-lg"
              title="Toggle Theme"
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? (
                <Sun size={20} weight="regular" data-testid="theme-icon-sun" />
              ) : (
                <Moon size={20} weight="regular" data-testid="theme-icon-moon" />
              )}
            </Button>
          </div>
        </header>

        {/* Scrollable main content */}
        <main id="main-content" className="flex-1 overflow-auto" aria-label="Main content">
          {children}
        </main>

        {/* Bottom navigation bar */}
        <nav className="shrink-0 bg-card border-t border-border" aria-label="Bottom navigation">
          <div className="flex items-center justify-around px-2 py-2">
            {bottomNavItems.map((item) => {
              const Icon = item.icon
              const isActive = activeView === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-[3.5rem]',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  <Icon size={22} weight={isActive ? 'fill' : 'regular'} />
                  <span className="text-xs font-medium">{item.label}</span>
                </button>
              )
            })}

            {/* Notifications with badge */}
            <button
              onClick={() => onNavigate('notifications')}
              aria-current={activeView === 'notifications' ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors relative min-w-[3.5rem]',
                activeView === 'notifications' ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <div className="relative">
                <Bell size={22} weight={activeView === 'notifications' ? 'fill' : 'regular'} />
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    <span data-testid="notification-count" role="status">
                      {notificationCount > 9 ? '9+' : notificationCount}
                      <span className="sr-only"> notifications</span>
                    </span>
                  </span>
                )}
              </div>
              <span className="text-xs font-medium">Notifications</span>
            </button>

            {/* More / full-navigation trigger */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors text-muted-foreground min-w-[3.5rem]"
            >
              <List size={22} weight="regular" />
              <span className="text-xs font-medium">More</span>
            </button>
          </div>
        </nav>

        {/* Full-navigation Sheet drawer */}
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
              <SheetDescription>Application navigation menu</SheetDescription>
            </SheetHeader>
            <div className="flex h-full flex-col">
              <div className="p-6 border-b border-border">
                <h1 className="text-2xl font-semibold text-primary">Orchestrate</h1>
                <p className="text-sm text-muted-foreground mt-1">Training Management</p>
              </div>
              <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto" aria-label="Primary navigation">
                {filteredNavItems.map((item) => {
                  const Icon = item.icon
                  const isActive = activeView === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => { onNavigate(item.id); setIsMobileMenuOpen(false) }}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-foreground hover:bg-secondary hover:text-foreground'
                      )}
                    >
                      <Icon size={20} weight={isActive ? 'fill' : 'regular'} />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  )
                })}
              </nav>
              <div className="px-3 py-4 border-t border-border space-y-1.5">
                <button
                  onClick={() => { onNavigate('notifications'); setIsMobileMenuOpen(false) }}
                  aria-current={activeView === 'notifications' ? 'page' : undefined}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200',
                    activeView === 'notifications'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <Bell size={20} weight={activeView === 'notifications' ? 'fill' : 'regular'} />
                  <span className="font-medium">Notifications</span>
                </button>
                {userRole === 'admin' && (
                  <button
                    onClick={() => { onNavigate('settings'); setIsMobileMenuOpen(false) }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200',
                      activeView === 'settings'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-foreground hover:bg-secondary hover:text-foreground'
                    )}
                  >
                    <Gear size={20} weight={activeView === 'settings' ? 'fill' : 'regular'} />
                    <span className="font-medium">Settings</span>
                  </button>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <NotificationSettingsDialog
          open={showNotificationSettings}
          onOpenChange={setShowNotificationSettings}
        />
      </div>
    )
  }

  // ─── Desktop layout ───────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-secondary">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-foreground focus:shadow-md"
      >
        Skip to main content
      </a>
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="text-2xl font-semibold text-primary">Orchestrate</h1>
          <p className="text-sm text-muted-foreground mt-1">Training Management</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1.5" aria-label="Primary navigation">
          {filteredNavItems.map(item => {
            const Icon = item.icon
            const isActive = activeView === item.id

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                <Icon size={20} weight={isActive ? 'fill' : 'regular'} />
                <span className="font-medium">{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="px-3 py-4 border-t border-border space-y-1.5">
          <button
            onClick={() => onNavigate('notifications')}
            aria-label="Open notifications"
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 relative',
              activeView === 'notifications'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            <Bell size={20} weight={activeView === 'notifications' ? 'fill' : 'regular'} />
            <span className="font-medium">Notifications</span>
            {notificationCount > 0 && (
              <Badge variant="destructive" className="ml-auto">
                <span
                  data-testid="notification-count"
                  role="status"
                >
                  {notificationCount}
                  <span className="sr-only"> notifications</span>
                </span>
              </Badge>
            )}
          </button>

          {userRole === 'admin' && (
            <button
              onClick={() => onNavigate('settings')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200',
                activeView === 'settings'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <Gear size={20} weight={activeView === 'settings' ? 'fill' : 'regular'} />
              <span className="font-medium">Settings</span>
            </button>
          )}
        </div>
      </aside>

      <main id="main-content" className="flex-1 overflow-auto flex flex-col" aria-label="Main content">
        <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-end gap-2">
          {currentUser && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-auto min-w-[220px] items-center justify-between gap-3 rounded-lg px-3 py-2"
                  aria-label="Open active user menu"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {currentUserInitials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 text-left">
                      <span className="block truncate text-sm font-medium">{currentUser.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{currentUser.email}</span>
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant={currentUser.role === 'admin' ? 'default' : currentUser.role === 'trainer' ? 'secondary' : 'outline'} className="capitalize">
                      {currentUser.role}
                    </Badge>
                    <CaretDown size={16} weight="bold" />
                  </span>
                </Button>
              </DropdownMenuTrigger>
              {userDropdownContent}
            </DropdownMenu>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowNotificationSettings(true)}
            className="rounded-lg"
            title="Notification Settings"
            aria-label="Notification settings"
          >
            <SpeakerHigh size={20} weight="regular" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-lg"
            title="Toggle Theme"
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? (
              <Sun size={20} weight="regular" data-testid="theme-icon-sun" />
            ) : (
              <Moon size={20} weight="regular" data-testid="theme-icon-moon" />
            )}
          </Button>
        </header>
        <div className="flex-1 pb-6">
          {children}
        </div>

        <NotificationSettingsDialog
          open={showNotificationSettings}
          onOpenChange={setShowNotificationSettings}
        />
      </main>
    </div>
  )
}
