import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CalendarBlank, ListBullets, ChartBar as ChartBarIcon, Plus, MapPin, Users as UsersIcon, Clock } from '@phosphor-icons/react'
import { Session, Course, User } from '@/lib/types'
import { format, startOfWeek, addDays, isSameDay } from 'date-fns'
import { formatDuration } from '@/lib/helpers'

interface ScheduleProps {
  sessions: Session[]
  courses: Course[]
  users: User[]
  currentUser: User
  onCreateSession: (session: Partial<Session>) => void
  onUpdateSession: (id: string, updates: Partial<Session>) => void
  onNavigate: (view: string, data?: any) => void
}

export function Schedule({ sessions, courses, users, currentUser, onCreateSession, onUpdateSession, onNavigate }: ScheduleProps) {
  const [viewType, setViewType] = useState<'calendar' | 'list' | 'gantt' | 'board'>('calendar')
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [currentWeek, setCurrentWeek] = useState(new Date())

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const handleSessionClick = (session: Session) => {
    setSelectedSession(session)
    setSheetOpen(true)
  }

  const renderCalendarView = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setCurrentWeek(addDays(currentWeek, -7))}
            >
              Previous
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setCurrentWeek(new Date())}
            >
              Today
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setCurrentWeek(addDays(currentWeek, 7))}
            >
              Next
            </Button>
          </div>
          <h3 className="text-lg font-medium">
            {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </h3>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {weekDays.map(day => {
            const daySessions = sessions.filter(s => isSameDay(new Date(s.startTime), day))
            const isToday = isSameDay(day, new Date())

            return (
              <div key={day.toString()} className={`border rounded-lg p-3 min-h-[200px] ${isToday ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <div className={`text-sm font-medium mb-2 ${isToday ? 'text-primary' : 'text-foreground'}`}>
                  {format(day, 'EEE')}
                </div>
                <div className={`text-2xl font-semibold mb-3 ${isToday ? 'text-primary' : 'text-foreground'}`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-2">
                  {daySessions.map(session => {
                    const course = courses.find(c => c.id === session.courseId)
                    return (
                      <button
                        key={session.id}
                        onClick={() => handleSessionClick(session)}
                        className="w-full text-left p-2 rounded bg-primary text-primary-foreground text-xs hover:opacity-90 transition-opacity"
                      >
                        <div className="font-medium truncate">{session.title}</div>
                        <div className="opacity-90">{format(new Date(session.startTime), 'h:mm a')}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderListView = () => {
    const sortedSessions = [...sessions].sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    )

    return (
      <div className="space-y-2">
        {sortedSessions.map(session => {
          const course = courses.find(c => c.id === session.courseId)
          const trainer = users.find(u => u.id === session.trainerId)
          
          return (
            <button
              key={session.id}
              onClick={() => handleSessionClick(session)}
              className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-secondary transition-colors text-left"
            >
              <div className="flex flex-col items-center justify-center w-16 h-16 bg-primary text-primary-foreground rounded">
                <div className="text-xs font-medium">{format(new Date(session.startTime), 'MMM')}</div>
                <div className="text-2xl font-bold">{format(new Date(session.startTime), 'd')}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground">{session.title}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {format(new Date(session.startTime), 'EEEE, h:mm a')} - {format(new Date(session.endTime), 'h:mm a')}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin size={14} />
                    {session.location}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <UsersIcon size={14} />
                    {session.enrolledStudents.length}/{session.capacity}
                  </span>
                  {course && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock size={14} />
                      {formatDuration(course.duration)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant={session.status === 'scheduled' ? 'secondary' : session.status === 'completed' ? 'default' : 'outline'}>
                  {session.status}
                </Badge>
                {trainer && (
                  <div className="text-xs text-muted-foreground">
                    {trainer.name}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  const renderBoardView = () => {
    const statusGroups = {
      scheduled: sessions.filter(s => s.status === 'scheduled'),
      'in-progress': sessions.filter(s => s.status === 'in-progress'),
      completed: sessions.filter(s => s.status === 'completed'),
    }

    return (
      <div className="grid grid-cols-3 gap-4">
        {Object.entries(statusGroups).map(([status, statusSessions]) => (
          <div key={status} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold capitalize">{status.replace('-', ' ')}</h3>
              <Badge variant="outline">{statusSessions.length}</Badge>
            </div>
            <div className="space-y-2">
              {statusSessions.map(session => {
                const course = courses.find(c => c.id === session.courseId)
                return (
                  <button
                    key={session.id}
                    onClick={() => handleSessionClick(session)}
                    className="w-full p-3 rounded-lg border border-border bg-card hover:bg-secondary transition-colors text-left"
                  >
                    <div className="font-medium text-foreground mb-1">{session.title}</div>
                    <div className="text-xs text-muted-foreground mb-2">
                      {format(new Date(session.startTime), 'MMM d, h:mm a')}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{session.location}</span>
                      <span className="text-muted-foreground">{session.enrolledStudents.length}/{session.capacity}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Schedule</h1>
          <p className="text-muted-foreground mt-1">Manage training sessions and schedules</p>
        </div>
        <Button onClick={() => onNavigate('schedule', { create: true })}>
          <Plus size={18} weight="bold" className="mr-2" />
          New Session
        </Button>
      </div>

      <Tabs value={viewType} onValueChange={(v) => setViewType(v as any)}>
        <TabsList>
          <TabsTrigger value="calendar">
            <CalendarBlank size={18} className="mr-2" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="list">
            <ListBullets size={18} className="mr-2" />
            List
          </TabsTrigger>
          <TabsTrigger value="board">
            <ChartBarIcon size={18} className="mr-2" />
            Board
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              {renderCalendarView()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              {renderListView()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="board" className="mt-6">
          {renderBoardView()}
        </TabsContent>
      </Tabs>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          {selectedSession && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedSession.title}</SheetTitle>
                <SheetDescription>
                  {format(new Date(selectedSession.startTime), 'EEEE, MMMM d, yyyy')}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 mt-6">
                <div>
                  <Label>Time</Label>
                  <div className="text-sm text-muted-foreground mt-1">
                    {format(new Date(selectedSession.startTime), 'h:mm a')} - {format(new Date(selectedSession.endTime), 'h:mm a')}
                  </div>
                </div>
                <div>
                  <Label>Location</Label>
                  <div className="text-sm text-muted-foreground mt-1">{selectedSession.location}</div>
                </div>
                <div>
                  <Label>Capacity</Label>
                  <div className="text-sm text-muted-foreground mt-1">
                    {selectedSession.enrolledStudents.length} / {selectedSession.capacity} enrolled
                  </div>
                </div>
                <div>
                  <Label>Status</Label>
                  <div className="mt-1">
                    <Badge>{selectedSession.status}</Badge>
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button 
                    className="flex-1" 
                    onClick={() => {
                      onNavigate('courses', { courseId: selectedSession.courseId })
                      setSheetOpen(false)
                    }}
                  >
                    View Course
                  </Button>
                  <Button variant="outline" className="flex-1">
                    Edit
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
