import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { MagnifyingGlass, Plus, UserCircle, ArrowLeft, WarningCircle } from '@phosphor-icons/react'
import { User, Enrollment, Course, Session } from '@/lib/types'
import { TrainerProfileView } from '@/components/TrainerProfileView'
import { TrainerProfileDialog } from '@/components/TrainerProfileDialog'
import { AddPersonDialog } from '@/components/AddPersonDialog'
import { DeletePersonDialog } from '@/components/DeletePersonDialog'
import { getTrainerShifts } from '@/lib/helpers'
import { format } from 'date-fns'

interface PeopleProps {
  users: User[]
  enrollments: Enrollment[]
  courses: Course[]
  sessions: Session[]
  currentUser: User
  onNavigate: (view: string, data?: any) => void
  onUpdateUser?: (user: User) => void
  onAddUser?: (user: User) => void
  onDeleteUser?: (userId: string) => void
}

export function People({ users, enrollments, courses, sessions, currentUser, onNavigate, onUpdateUser, onAddUser, onDeleteUser }: PeopleProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'trainer' | 'employee'>('all')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)

  useEffect(() => {
    if (selectedUser) {
      const updatedUser = users.find(u => u.id === selectedUser.id)
      if (updatedUser && JSON.stringify(updatedUser) !== JSON.stringify(selectedUser)) {
        setSelectedUser(updatedUser)
      }
    }
  }, [users])

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.department.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter
    
    return matchesSearch && matchesRole
  })

  const getUserEnrollmentStats = (userId: string) => {
    const userEnrollments = enrollments.filter(e => e.userId === userId)
    return {
      total: userEnrollments.length,
      completed: userEnrollments.filter(e => e.status === 'completed').length,
      inProgress: userEnrollments.filter(e => e.status === 'in-progress').length,
    }
  }

  const handleUserClick = (user: User) => {
    setSelectedUser(user)
  }

  const handleEditProfile = () => {
    setEditDialogOpen(true)
  }

  const handleSaveProfile = (updatedUser: User) => {
    if (onUpdateUser) {
      onUpdateUser(updatedUser)
    }
    setSelectedUser(updatedUser)
    setEditDialogOpen(false)
  }

  const handleAddPerson = (newUser: User) => {
    if (onAddUser) {
      onAddUser(newUser)
    }
    setAddDialogOpen(false)
  }

  const handleDeleteClick = (user: User, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    setUserToDelete(user)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = () => {
    if (userToDelete && onDeleteUser) {
      onDeleteUser(userToDelete.id)
      if (selectedUser?.id === userToDelete.id) {
        setSelectedUser(null)
      }
    }
    setDeleteDialogOpen(false)
    setUserToDelete(null)
  }

  const existingEmails = users.map(u => u.email.toLowerCase())

  return (
    <div className="p-6 space-y-6">
      {selectedUser ? (
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => setSelectedUser(null)}>
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
              <h1 className="text-3xl font-semibold text-foreground">People</h1>
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
                className="pl-10"
              />
            </div>
          </div>

          <Tabs value={roleFilter} onValueChange={(v) => setRoleFilter(v as any)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="employee">Employees</TabsTrigger>
              <TabsTrigger value="trainer">Trainers</TabsTrigger>
              <TabsTrigger value="admin">Admins</TabsTrigger>
            </TabsList>

            <TabsContent value={roleFilter} className="mt-6">
              <Card>
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Shifts</TableHead>
                        <TableHead>Enrollments</TableHead>
                        <TableHead>Certifications</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map(user => {
                        const stats = getUserEnrollmentStats(user.id)
                        const isTrainerWithoutSchedule = user.role === 'trainer' && 
                          (!user.trainerProfile?.shiftSchedules || user.trainerProfile.shiftSchedules.length === 0)
                        
                        return (
                          <TableRow key={user.id} className="cursor-pointer hover:bg-secondary" onClick={() => handleUserClick(user)}>
                            <TableCell>
                              <div className="flex items-center gap-3">
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
                                          <TooltipTrigger>
                                            <WarningCircle size={16} weight="fill" className="text-amber-600 dark:text-amber-500" />
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
                              </div>
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
                              ) : (
                                <div className="flex gap-1">
                                  {getTrainerShifts(user).map(shift => (
                                    <Badge key={shift} variant="secondary" className="text-xs">
                                      {shift}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div>{stats.completed} completed</div>
                                <div className="text-muted-foreground">{stats.inProgress} in progress</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-muted-foreground">
                                {user.certifications.length} certs
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm">
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
    </div>
  )
}
