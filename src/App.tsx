import { useState, useCallback, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import { Layout } from '@/components/Layout'
import { Dashboard } from '@/components/views/Dashboard'
import { Schedule } from '@/components/views/Schedule'
import { ScheduleTemplates } from '@/components/views/ScheduleTemplates'
import { Courses } from '@/components/views/Courses'
import { People } from '@/components/views/People'
import { Analytics } from '@/components/views/Analytics'
import { TrainerAvailability } from '@/components/views/TrainerAvailability'
import { BurnoutDashboard } from '@/components/views/BurnoutDashboard'
import { TrainerWellness } from '@/components/views/TrainerWellness'
import { CertificationDashboard } from '@/components/views/CertificationDashboard'
import { User, Session, Course, Enrollment, Notification, CertificationRecord } from '@/lib/types'
import { useUtilizationNotifications } from '@/hooks/use-utilization-notifications'
import { useCertificationNotifications } from '@/hooks/use-certification-notifications'
import { ensureAllTrainersHaveProfiles } from '@/lib/trainer-profile-generator'

function App() {
  const [activeView, setActiveView] = useState('dashboard')
  
  const [users, setUsers] = useKV<User[]>('users', [])
  const [sessions, setSessions] = useKV<Session[]>('sessions', [])
  const [courses] = useKV<Course[]>('courses', [])
  const [enrollments] = useKV<Enrollment[]>('enrollments', [])
  const [notifications, setNotifications] = useKV<Notification[]>('notifications', [])

  useEffect(() => {
    if (users && users.length > 0) {
      const trainers = users.filter(u => u.role === 'trainer')
      const trainersWithoutProfiles = trainers.filter(t => !t.trainerProfile)
      
      if (trainersWithoutProfiles.length > 0) {
        const updatedUsers = ensureAllTrainersHaveProfiles(users)
        setUsers(updatedUsers)
      }
    }
  }, [])

  const safeUsers = users || []
  const safeSessions = sessions || []
  const safeCourses = courses || []
  const safeEnrollments = enrollments || []
  const safeNotifications = notifications || []

  const handleCreateNotification = useCallback((notification: Omit<Notification, 'id' | 'createdAt'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    }
    
    setNotifications((current) => [newNotification, ...(current || [])])
    
    if (notification.priority === 'critical' || notification.priority === 'high') {
      const icon = notification.priority === 'critical' ? '🚨' : '⚠️'
      toast.error(`${icon} ${notification.title}`, {
        description: notification.message,
        duration: 8000
      })
    }
  }, [setNotifications])

  useUtilizationNotifications(safeUsers, safeSessions, handleCreateNotification)

  useCertificationNotifications(safeUsers, handleCreateNotification, setUsers)

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
    const newSession: Session = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      courseId: session.courseId || '',
      trainerId: session.trainerId || '',
      title: session.title || 'Untitled Session',
      startTime: session.startTime || new Date().toISOString(),
      endTime: session.endTime || new Date().toISOString(),
      shift: session.shift || 'day',
      location: session.location || 'TBD',
      capacity: session.capacity || 20,
      enrolledStudents: session.enrolledStudents || [],
      status: session.status || 'scheduled',
      ...(session.recurrence && { recurrence: session.recurrence })
    }
    
    setSessions((currentSessions) => [...(currentSessions || []), newSession])
  }

  const handleCreateMultipleSessions = (sessions: Partial<Session>[]) => {
    const newSessions: Session[] = sessions.map(session => ({
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      courseId: session.courseId || '',
      trainerId: session.trainerId || '',
      title: session.title || 'Untitled Session',
      startTime: session.startTime || new Date().toISOString(),
      endTime: session.endTime || new Date().toISOString(),
      shift: session.shift || 'day',
      location: session.location || 'TBD',
      capacity: session.capacity || 20,
      enrolledStudents: session.enrolledStudents || [],
      status: session.status || 'scheduled',
      ...(session.recurrence && { recurrence: session.recurrence })
    }))
    
    setSessions((currentSessions) => [...(currentSessions || []), ...newSessions])
  }

  const handleUpdateSession = (id: string, updates: Partial<Session>) => {
    setSessions((currentSessions) =>
      (currentSessions || []).map(session =>
        session.id === id ? { ...session, ...updates } : session
      )
    )
  }

  const handleUpdateUser = (updatedUser: User) => {
    setUsers((currentUsers) =>
      (currentUsers || []).map(user =>
        user.id === updatedUser.id ? updatedUser : user
      )
    )
  }

  const handleAddUser = (newUser: User) => {
    setUsers((currentUsers) => [...(currentUsers || []), newUser])
  }

  const handleDeleteUser = (userId: string) => {
    setUsers((currentUsers) => (currentUsers || []).filter(user => user.id !== userId))
    setSessions((currentSessions) => (currentSessions || []).map(session => {
      if (session.trainerId === userId) {
        return { ...session, trainerId: '', status: 'scheduled' as const }
      }
      if (session.enrolledStudents.includes(userId)) {
        return { ...session, enrolledStudents: session.enrolledStudents.filter(id => id !== userId) }
      }
      return session
    }))
  }

  const handleAddCertification = useCallback((trainerIds: string[], certification: Omit<CertificationRecord, 'status' | 'renewalRequired' | 'remindersSent'>) => {
    setUsers((currentUsers) =>
      (currentUsers || []).map(user => {
        if (!trainerIds.includes(user.id) || user.role !== 'trainer') {
          return user
        }

        const newCertificationRecord: CertificationRecord = {
          ...certification,
          status: 'active',
          renewalRequired: false,
          remindersSent: 0
        }

        const existingRecords = user.trainerProfile?.certificationRecords || []

        return {
          ...user,
          trainerProfile: {
            ...user.trainerProfile!,
            certificationRecords: [...existingRecords, newCertificationRecord]
          }
        }
      })
    )
  }, [setUsers])

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
      case 'schedule-templates':
        return (
          <ScheduleTemplates
            courses={safeCourses}
            onNavigate={handleNavigate}
            onCreateSessions={handleCreateMultipleSessions}
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
            sessions={safeSessions}
            currentUser={currentUser}
            onNavigate={handleNavigate}
            onUpdateUser={handleUpdateUser}
            onAddUser={handleAddUser}
            onDeleteUser={handleDeleteUser}
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
      case 'trainer-availability':
        return (
          <TrainerAvailability
            users={safeUsers}
            sessions={safeSessions}
            courses={safeCourses}
            onNavigate={handleNavigate}
          />
        )
      case 'burnout-dashboard':
        return (
          <BurnoutDashboard
            users={safeUsers}
            sessions={safeSessions}
            courses={safeCourses}
            onNavigate={handleNavigate}
          />
        )
      case 'certifications':
        return (
          <CertificationDashboard
            users={safeUsers}
            onNavigate={handleNavigate}
            onAddCertification={handleAddCertification}
          />
        )
      case 'trainer-wellness':
        return (
          <TrainerWellness
            users={safeUsers}
            sessions={safeSessions}
            currentUser={currentUser}
            onNavigate={handleNavigate}
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