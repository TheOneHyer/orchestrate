import { useState, useEffect, useMemo, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { MagnifyingGlass, Plus, UserCircle, ArrowLeft, WarningCircle } from '@phosphor-icons/react'
import { User, Enrollment, Course, Session } from '@/lib/types'
import { getMissingCertificationsForUser } from '@/lib/competency-insights'
import { TrainerProfileView } from '@/components/TrainerProfileView'
import { TrainerProfileDialog } from '@/components/TrainerProfileDialog'
import { AddPersonDialog } from '@/components/AddPersonDialog'
import { DeletePersonDialog } from '@/components/DeletePersonDialog'

/** Props for the People component. */
interface PeopleProps {
  /** List of all users in the system. */
  users: User[]
  /** All course enrolment records. */
  enrollments: Enrollment[]
  /** All available courses. */
  courses: Course[]
  /** All training sessions. */
  sessions: Session[]
  /** The currently authenticated user; controls which admin actions are shown. */
  currentUser: User
  /** Optional callback invoked when a user profile is saved after editing. */
  onUpdateUser?: (user: User) => void
  /** Optional callback invoked when a new person is added. */
  onAddUser?: (user: User) => void
  /** Optional callback invoked when a user is deleted. @param userId - ID of the user to delete. */
  onDeleteUser?: (userId: string) => void
  /** Optional navigation payload used to deep-link to a specific user profile. */
  navigationPayload?: unknown
  /** Optional callback invoked after a navigation payload has been consumed. */
  onNavigationPayloadConsumed?: () => void
}

/**
 * Type guard for people view navigation payload.
 * @param value - Unknown payload to validate.
 * @returns True when payload contains a string `userId`.
 */
function hasUserIdPayload(value: unknown): value is { userId: string } {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>

  return 'userId' in candidate && typeof candidate.userId === 'string'
}

/**
 * Renders the People management interface, showing a searchable, role-filterable list and a detailed profile view when a user is selected.
 *
 * Provides admin controls to add and delete users and to edit trainer profiles. Highlights trainers missing shift schedules and displays per-user enrollment and certification summaries.
 */
export function People({ users, enrollments, courses, sessions, currentUser, onUpdateUser, onAddUser, onDeleteUser, navigationPayload, onNavigationPayloadConsumed }: PeopleProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'trainer' | 'employee'>('all')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const processedUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    setSelectedUser((currentSelectedUser) => {
      if (!currentSelectedUser) {
        return currentSelectedUser
      }

      const updatedUser = users.find((user) => user.id === currentSelectedUser.id)
      if (!updatedUser) {
        return null
      }

      // Always sync to the latest user object from `users` so all fields stay up to date.
      return updatedUser
    })
  }, [users])

  useEffect(() => {
    if (!hasUserIdPayload(navigationPayload)) {
      processedUserIdRef.current = null
      return
    }

    if (processedUserIdRef.current === navigationPayload.userId) {
      return
    }

    const targetUser = users.find((user) => user.id === navigationPayload.userId)
    if (targetUser) {
      setSelectedUser(targetUser)
      setRoleFilter('all')
      setSearchQuery('')
      processedUserIdRef.current = navigationPayload.userId
      onNavigationPayloadConsumed?.()
    }
  }, [navigationPayload, onNavigationPayloadConsumed, users])

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.department.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesRole = roleFilter === 'all' || user.role === roleFilter

    return matchesSearch && matchesRole
  })

  /**
   * Returns total, completed, and in-progress enrollment counts for the given user.
   *
   * @param userId - The user ID to look up enrollments for.
   * @returns An object with `total`, `completed`, and `inProgress` counts.
   */
  const getUserEnrollmentStats = (userId: string) => {
    const userEnrollments = enrollments.filter(e => e.userId === userId)
    return {
      total: userEnrollments.length,
      completed: userEnrollments.filter(e => e.status === 'completed').length,
      inProgress: userEnrollments.filter(e => e.status === 'in-progress').length,
    }
  }

  const certificationGapStatsByUserId = useMemo(() => {
    const map = new Map<string, { certificationCount: number; missingCount: number }>()
    users.forEach((user) => {
      const normalizedCertificationCount = new Set(
        user.certifications
          .map((certification) => certification.trim())
          .filter((certification) => certification.length > 0),
      ).size
      const missingCertifications = getMissingCertificationsForUser(user, courses)
      map.set(user.id, {
        certificationCount: normalizedCertificationCount,
        missingCount: missingCertifications.length,
      })
    })

    return map
  }, [courses, users])

  /**
   * Returns certification coverage summary for the given user.
   *
   * @param user - User whose certification gaps are being evaluated.
   * @returns Existing certification count and missing certification count.
   */
  const getUserCertificationGapStats = (user: User) => {
    const normalizedCertificationCount = new Set(
      user.certifications
        .map((certification) => certification.trim())
        .filter((certification) => certification.length > 0),
    ).size

    return certificationGapStatsByUserId.get(user.id) || {
      certificationCount: normalizedCertificationCount,
      missingCount: getMissingCertificationsForUser(user, courses).length,
    }
  }

  /**
   * Sets the selected user to display in the detail panel.
   *
   * @param user - The user to select.
   */
  const handleUserClick = (user: User) => {
    setSelectedUser(user)
  }

  /** Opens the trainer profile edit dialog for the selected user. */
  const handleEditProfile = () => {
    setEditDialogOpen(true)
  }

  /**
   * Persists the updated user and refreshes the selected user display.
   *
   * @param updatedUser - The updated user object to save.
   */
  const handleSaveProfile = (updatedUser: User) => {
    if (onUpdateUser) {
      onUpdateUser(updatedUser)
    }
    setSelectedUser(updatedUser)
    setEditDialogOpen(false)
  }

  /**
   * Saves the new user and closes the add-person dialog.
   *
   * @param newUser - The newly created user object.
   */
  const handleAddPerson = (newUser: User) => {
    if (onAddUser) {
      onAddUser(newUser)
    }
    setAddDialogOpen(false)
  }

  /**
   * Stores the selected user to delete and opens the delete confirmation dialog.
   *
   * @param user - The user targeted for deletion.
   */
  const handleDeleteClick = (user: User) => {
    setUserToDelete(user)
    setDeleteDialogOpen(true)
  }

  /** Deletes the stored user and closes the confirmation dialog. */
  const handleConfirmDelete = () => {
    if (userToDelete && onDeleteUser) {
      onDeleteUser(userToDelete.id)
      if (selectedUser?.id === userToDelete.id) {
        setSelectedUser(null)
        processedUserIdRef.current = null
      }
    }
    setDeleteDialogOpen(false)
    setUserToDelete(null)
  }

  const existingEmails = users.map(u => u.email.toLowerCase())

  return (
    <section className="p-6 space-y-6" aria-labelledby="people-heading">
      {selectedUser ? (
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => {
            setSelectedUser(null)
            processedUserIdRef.current = null
          }}>
            <ArrowLeft size={18} className="mr-2" />
            Back to People
          </Button>
          <TrainerProfileView
            user={selectedUser}
            sessions={sessions}
            courses={courses}
            enrollments={enrollments}
            onEdit={selectedUser.role === 'trainer' && currentUser.role === 'admin' ? handleEditProfile : undefined}
            onDelete={currentUser.role === 'admin' ? () => handleDeleteClick(selectedUser) : undefined}
          />
          {selectedUser.role === 'trainer' && (
            <TrainerProfileDialog
              user={selectedUser}
              open={editDialogOpen}
              onOpenChange={setEditDialogOpen}
              onSave={handleSaveProfile}
            />
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 id="people-heading" className="text-3xl font-semibold text-foreground">People</h1>
              <p className="text-muted-foreground mt-1">Manage employees and training profiles</p>
            </div>
            {currentUser.role === 'admin' && (
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus size={18} weight="bold" className="mr-2" />
                Add Person
              </Button>
            )}
          </div>

          <div className="flex gap-4">
            <div className="relative flex-1">
              <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search people..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search people"
                className="pl-10"
              />
            </div>
          </div>

          <Tabs value={roleFilter} onValueChange={(v) => setRoleFilter(v as 'all' | 'admin' | 'trainer' | 'employee')}>
            <TabsList aria-label="Filter people by role">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="employee">Employees</TabsTrigger>
              <TabsTrigger value="trainer">Trainers</TabsTrigger>
              <TabsTrigger value="admin">Admins</TabsTrigger>
            </TabsList>

            <TabsContent value={roleFilter} className="mt-6">
              <Card>
                <CardContent className="pt-6">
                  <Table aria-label="People directory">
                    <TableCaption className="sr-only">
                      People directory with role, department, schedule, enrollment, and certification status.
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">Name</TableHead>
                        <TableHead scope="col">Role</TableHead>
                        <TableHead scope="col">Department</TableHead>
                        <TableHead scope="col">Shifts</TableHead>
                        <TableHead scope="col">Enrollments</TableHead>
                        <TableHead scope="col">Certifications</TableHead>
                        <TableHead scope="col"><span className="sr-only">Actions</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map(user => {
                        const stats = getUserEnrollmentStats(user.id)
                        const certificationGapStats = getUserCertificationGapStats(user)
                        const isTrainerWithoutSchedule = user.role === 'trainer' &&
                          (!user.trainerProfile?.shiftSchedules || user.trainerProfile.shiftSchedules.length === 0)

                        return (
                          <TableRow
                            key={user.id}
                            className="hover:bg-secondary"
                          >
                            <TableCell>
                              <button
                                type="button"
                                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={`View profile for ${user.name}`}
                                onClick={() => handleUserClick(user)}
                              >
                                <Avatar>
                                  <AvatarFallback className="bg-primary text-primary-foreground">
                                    {user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{user.name}</span>
                                    {isTrainerWithoutSchedule && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span aria-label={`Schedule not configured for ${user.name}`}>
                                              <WarningCircle size={16} weight="fill" className="text-amber-600 dark:text-amber-500" />
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            Schedule not configured
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                  <div className="text-sm text-muted-foreground">{user.email}</div>
                                </div>
                              </button>
                            </TableCell>
                            <TableCell>
                              <Badge variant={user.role === 'admin' ? 'default' : 'outline'}>
                                {user.role}
                              </Badge>
                            </TableCell>
                            <TableCell>{user.department}</TableCell>
                            <TableCell>
                              {isTrainerWithoutSchedule ? (
                                <Badge variant="outline" className="text-amber-600 dark:text-amber-500 border-amber-300 dark:border-amber-700">
                                  Not configured
                                </Badge>
                              ) : user.role === 'trainer' && user.trainerProfile?.shiftSchedules ? (
                                <div className="flex gap-1">
                                  {user.trainerProfile.shiftSchedules.map((schedule, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      {schedule.shiftCode}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div>{stats.completed} completed</div>
                                <div className="text-muted-foreground">{stats.inProgress} in progress</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-muted-foreground space-y-1">
                                <div>
                                  {certificationGapStats.certificationCount} {certificationGapStats.certificationCount === 1 ? 'cert' : 'certs'}
                                </div>
                                <div className={certificationGapStats.missingCount > 0 ? 'text-amber-700 dark:text-amber-400' : ''}>
                                  {certificationGapStats.missingCount} {certificationGapStats.missingCount === 1 ? 'gap' : 'gaps'}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => handleUserClick(user)}>
                                View Profile
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <UserCircle size={64} className="mx-auto text-muted-foreground opacity-50 mb-4" />
              <p className="text-muted-foreground">No people found</p>
            </div>
          )}

          <AddPersonDialog
            open={addDialogOpen}
            onOpenChange={setAddDialogOpen}
            onSave={handleAddPerson}
            existingEmails={existingEmails}
          />

          <DeletePersonDialog
            user={userToDelete}
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            onConfirm={handleConfirmDelete}
          />
        </>
      )}
    </section>
  )
}
