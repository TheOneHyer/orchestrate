import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Toaster } from '@/components/ui/sonner'
import { Layout } from '@/components/Layout'
import { Dashboard } from '@/components/views/Dashboard'
import { Schedule } from '@/components/views/Schedule'
import { Courses } from '@/components/views/Courses'
import { People } from '@/components/views/People'
import { Analytics } from '@/components/views/Analytics'
import { User, Session, Course, Enrollment, Notification } from '@/lib/types'

function App() {
  const [activeView, setActiveView] = useState('dashboard')
  
  const [users] = useKV<User[]>('users', [])
  const [sessions] = useKV<Session[]>('sessions', [])
  const [courses] = useKV<Course[]>('courses', [])
  const [enrollments] = useKV<Enrollment[]>('enrollments', [])
  const [notifications] = useKV<Notification[]>('notifications', [])

  const safeUsers = users || []
  const safeSessions = sessions || []
  const safeCourses = courses || []
  const safeEnrollments = enrollments || []
  const safeNotifications = notifications || []

  const currentUser: User = safeUsers[0] || {
    id: '1',
    name: 'Admin User',
    email: 'admin@company.com',
    role: 'admin',
    department: 'Administration',
    shifts: ['day'],
    certifications: [],
    hireDate: new Date().toISOString()
  }

  const upcomingSessions = safeSessions
    .filter(s => new Date(s.startTime) > new Date())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 10)

  const unreadNotifications = safeNotifications.filter(n => !n.read)

  const handleNavigate = (view: string, data?: any) => {
    setActiveView(view)
  }

  const handleCreateSession = (session: Partial<Session>) => {
    console.log('Create session:', session)
  }

  const handleUpdateSession = (id: string, updates: Partial<Session>) => {
    console.log('Update session:', id, updates)
  }

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <Dashboard
            currentUser={currentUser}
            upcomingSessions={upcomingSessions}
            notifications={safeNotifications}
            enrollments={safeEnrollments}
            courses={safeCourses}
            onNavigate={handleNavigate}
          />
        )
      case 'schedule':
        return (
          <Schedule
            sessions={safeSessions}
            courses={safeCourses}
            users={safeUsers}
            currentUser={currentUser}
            onCreateSession={handleCreateSession}
            onUpdateSession={handleUpdateSession}
            onNavigate={handleNavigate}
          />
        )
      case 'courses':
        return (
          <Courses
            courses={safeCourses}
            enrollments={safeEnrollments}
            currentUser={currentUser}
            onNavigate={handleNavigate}
          />
        )
      case 'people':
        return (
          <People
            users={safeUsers}
            enrollments={safeEnrollments}
            courses={safeCourses}
            currentUser={currentUser}
            onNavigate={handleNavigate}
          />
        )
      case 'analytics':
        return (
          <Analytics
            users={safeUsers}
            enrollments={safeEnrollments}
            sessions={safeSessions}
            courses={safeCourses}
          />
        )
      case 'notifications':
        return (
          <div className="p-6">
            <h1 className="text-3xl font-semibold">Notifications</h1>
            <p className="text-muted-foreground mt-1">Manage your notifications</p>
          </div>
        )
      case 'settings':
        return (
          <div className="p-6">
            <h1 className="text-3xl font-semibold">Settings</h1>
            <p className="text-muted-foreground mt-1">Configure system settings</p>
          </div>
        )
      default:
        return (
          <Dashboard
            currentUser={currentUser}
            upcomingSessions={upcomingSessions}
            notifications={safeNotifications}
            enrollments={safeEnrollments}
            courses={safeCourses}
            onNavigate={handleNavigate}
          />
        )
    }
  }

  return (
    <>
      <Layout
        activeView={activeView}
        onNavigate={handleNavigate}
        notificationCount={unreadNotifications.length}
        userRole={currentUser.role}
      >
        {renderView()}
      </Layout>
      <Toaster />
    </>
  )
}

export default App