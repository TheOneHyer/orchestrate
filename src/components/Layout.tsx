import { ReactNode } from 'react'
import { 
  House, 
  CalendarDots, 
  GraduationCap, 
  Users, 
  ChartBar, 
  Bell,
  Gear,
  Calendar,
  Heart
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface LayoutProps {
  children: ReactNode
  activeView: string
  onNavigate: (view: string) => void
  notificationCount?: number
  userRole: 'admin' | 'trainer' | 'employee'
}

export function Layout({ children, activeView, onNavigate, notificationCount = 0, userRole }: LayoutProps) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: House, roles: ['admin', 'trainer', 'employee'] },
    { id: 'schedule', label: 'Schedule', icon: CalendarDots, roles: ['admin', 'trainer', 'employee'] },
    { id: 'trainer-availability', label: 'Trainer Availability', icon: Calendar, roles: ['admin', 'trainer'] },
    { id: 'burnout-dashboard', label: 'Burnout Risk', icon: Heart, roles: ['admin'] },
    { id: 'trainer-wellness', label: 'Wellness & Recovery', icon: Heart, roles: ['admin'] },
    { id: 'courses', label: 'Courses', icon: GraduationCap, roles: ['admin', 'trainer', 'employee'] },
    { id: 'people', label: 'People', icon: Users, roles: ['admin', 'trainer'] },
    { id: 'analytics', label: 'Analytics', icon: ChartBar, roles: ['admin', 'trainer'] },
  ]

  const filteredNavItems = navItems.filter(item => item.roles.includes(userRole))

  return (
    <div className="flex h-screen bg-secondary">
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="text-2xl font-semibold text-primary">TrainSync</h1>
          <p className="text-sm text-muted-foreground mt-1">Training Management</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {filteredNavItems.map(item => {
            const Icon = item.icon
            const isActive = activeView === item.id
            
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
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

        <div className="p-4 border-t border-border space-y-1">
          <button
            onClick={() => onNavigate('notifications')}
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
                {notificationCount}
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

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
