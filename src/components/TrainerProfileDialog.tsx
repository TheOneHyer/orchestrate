import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { User, ShiftSchedule, DayOfWeek, ShiftType } from '@/lib/types'
import { Plus, Trash, Clock, Calendar } from '@phosphor-icons/react'
import { differenceInMonths, differenceInYears } from 'date-fns'

interface TrainerProfileDialogProps {
  user: User
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (user: User) => void
}

const DAYS_OF_WEEK: { value: DayOfWeek; label: string }[] = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
]

const SHIFT_TYPES: { value: ShiftType; label: string }[] = [
  { value: 'day', label: 'Day Shift' },
  { value: 'evening', label: 'Evening Shift' },
  { value: 'night', label: 'Night Shift' },
]

export function TrainerProfileDialog({ user, open, onOpenChange, onSave }: TrainerProfileDialogProps) {
  const [editedUser, setEditedUser] = useState<User>(user)
  const [newRole, setNewRole] = useState('')
  const [newSpecialization, setNewSpecialization] = useState('')

  useEffect(() => {
    if (!editedUser.trainerProfile) {
      const yearsOfService = differenceInYears(new Date(), new Date(editedUser.hireDate))
      const monthsOfService = differenceInMonths(new Date(), new Date(editedUser.hireDate))
      
      setEditedUser({
        ...editedUser,
        trainerProfile: {
          authorizedRoles: [],
          shiftSchedules: [],
          tenure: {
            hireDate: editedUser.hireDate,
            yearsOfService,
            monthsOfService,
          },
          specializations: [],
        },
      })
    }
  }, [])

  const calculateHoursPerWeek = (schedule: ShiftSchedule): number => {
    const start = schedule.startTime.split(':').map(Number)
    const end = schedule.endTime.split(':').map(Number)
    const hoursPerDay = (end[0] + end[1] / 60) - (start[0] + start[1] / 60)
    return hoursPerDay * schedule.daysWorked.length
  }

  const addShiftSchedule = () => {
    if (!editedUser.trainerProfile) return

    const newSchedule: ShiftSchedule = {
      shiftCode: `SHIFT-${Date.now()}`,
      shiftType: 'day',
      daysWorked: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      startTime: '09:00',
      endTime: '17:00',
      totalHoursPerWeek: 40,
    }

    setEditedUser({
      ...editedUser,
      trainerProfile: {
        ...editedUser.trainerProfile,
        shiftSchedules: [...editedUser.trainerProfile.shiftSchedules, newSchedule],
      },
    })
  }

  const removeShiftSchedule = (index: number) => {
    if (!editedUser.trainerProfile) return

    setEditedUser({
      ...editedUser,
      trainerProfile: {
        ...editedUser.trainerProfile,
        shiftSchedules: editedUser.trainerProfile.shiftSchedules.filter((_, i) => i !== index),
      },
    })
  }

  const updateShiftSchedule = (index: number, updates: Partial<ShiftSchedule>) => {
    if (!editedUser.trainerProfile) return

    const updatedSchedules = [...editedUser.trainerProfile.shiftSchedules]
    updatedSchedules[index] = { ...updatedSchedules[index], ...updates }

    if (updates.startTime || updates.endTime || updates.daysWorked) {
      updatedSchedules[index].totalHoursPerWeek = calculateHoursPerWeek(updatedSchedules[index])
    }

    setEditedUser({
      ...editedUser,
      trainerProfile: {
        ...editedUser.trainerProfile,
        shiftSchedules: updatedSchedules,
      },
    })
  }

  const toggleDayWorked = (scheduleIndex: number, day: DayOfWeek) => {
    if (!editedUser.trainerProfile) return

    const schedule = editedUser.trainerProfile.shiftSchedules[scheduleIndex]
    const daysWorked = schedule.daysWorked.includes(day)
      ? schedule.daysWorked.filter(d => d !== day)
      : [...schedule.daysWorked, day]

    updateShiftSchedule(scheduleIndex, { daysWorked })
  }

  const addAuthorizedRole = () => {
    if (!editedUser.trainerProfile || !newRole.trim()) return

    setEditedUser({
      ...editedUser,
      trainerProfile: {
        ...editedUser.trainerProfile,
        authorizedRoles: [...editedUser.trainerProfile.authorizedRoles, newRole.trim()],
      },
    })
    setNewRole('')
  }

  const removeAuthorizedRole = (role: string) => {
    if (!editedUser.trainerProfile) return

    setEditedUser({
      ...editedUser,
      trainerProfile: {
        ...editedUser.trainerProfile,
        authorizedRoles: editedUser.trainerProfile.authorizedRoles.filter(r => r !== role),
      },
    })
  }

  const addSpecialization = () => {
    if (!editedUser.trainerProfile || !newSpecialization.trim()) return

    setEditedUser({
      ...editedUser,
      trainerProfile: {
        ...editedUser.trainerProfile,
        specializations: [...editedUser.trainerProfile.specializations, newSpecialization.trim()],
      },
    })
    setNewSpecialization('')
  }

  const removeSpecialization = (spec: string) => {
    if (!editedUser.trainerProfile) return

    setEditedUser({
      ...editedUser,
      trainerProfile: {
        ...editedUser.trainerProfile,
        specializations: editedUser.trainerProfile.specializations.filter(s => s !== spec),
      },
    })
  }

  const handleSave = () => {
    onSave(editedUser)
    onOpenChange(false)
  }

  if (!editedUser.trainerProfile) return null

  const totalWeeklyHours = editedUser.trainerProfile.shiftSchedules.reduce(
    (sum, schedule) => sum + schedule.totalHoursPerWeek,
    0
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Trainer Profile: {user.name}</DialogTitle>
          <DialogDescription>
            Configure shift schedules, authorized teaching roles, and trainer-specific settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar size={20} />
                Tenure Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Hire Date</Label>
                  <p className="text-base font-medium">
                    {new Date(editedUser.trainerProfile.tenure.hireDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Years of Service</Label>
                  <p className="text-base font-medium">
                    {editedUser.trainerProfile.tenure.yearsOfService} years
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Total Months</Label>
                  <p className="text-base font-medium">
                    {editedUser.trainerProfile.tenure.monthsOfService} months
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock size={20} />
                  Shift Schedules
                </CardTitle>
                <Button size="sm" onClick={addShiftSchedule}>
                  <Plus size={16} weight="bold" className="mr-1" />
                  Add Schedule
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {editedUser.trainerProfile.shiftSchedules.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No shift schedules configured. Click "Add Schedule" to create one.
                </p>
              ) : (
                editedUser.trainerProfile.shiftSchedules.map((schedule, index) => (
                  <Card key={index} className="border-2">
                    <CardContent className="pt-4 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="grid grid-cols-3 gap-4 flex-1">
                          <div>
                            <Label>Shift Code</Label>
                            <Input
                              value={schedule.shiftCode}
                              onChange={(e) => updateShiftSchedule(index, { shiftCode: e.target.value })}
                              placeholder="e.g., DAY-A"
                            />
                          </div>
                          <div>
                            <Label>Shift Type</Label>
                            <Select
                              value={schedule.shiftType}
                              onValueChange={(value: ShiftType) =>
                                updateShiftSchedule(index, { shiftType: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SHIFT_TYPES.map(type => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-end">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => removeShiftSchedule(index)}
                            >
                              <Trash size={16} weight="bold" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Start Time</Label>
                          <Input
                            type="time"
                            value={schedule.startTime}
                            onChange={(e) => updateShiftSchedule(index, { startTime: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>End Time</Label>
                          <Input
                            type="time"
                            value={schedule.endTime}
                            onChange={(e) => updateShiftSchedule(index, { endTime: e.target.value })}
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Days Worked</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {DAYS_OF_WEEK.map(day => (
                            <div key={day.value} className="flex items-center space-x-2">
                              <Checkbox
                                id={`${index}-${day.value}`}
                                checked={schedule.daysWorked.includes(day.value)}
                                onCheckedChange={() => toggleDayWorked(index, day.value)}
                              />
                              <label
                                htmlFor={`${index}-${day.value}`}
                                className="text-sm font-medium leading-none cursor-pointer"
                              >
                                {day.label.substring(0, 3)}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Badge variant="secondary">
                          {schedule.totalHoursPerWeek} hours/week
                        </Badge>
                        <Badge variant="outline">
                          {schedule.daysWorked.length} days/week
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}

              {totalWeeklyHours > 0 && (
                <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                  <span className="text-sm font-medium">Total Weekly Hours (All Schedules)</span>
                  <Badge className="text-base">{totalWeeklyHours} hours</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Authorized Teaching Roles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Add authorized role (e.g., 'Safety Instructor')"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addAuthorizedRole()}
                />
                <Button onClick={addAuthorizedRole}>
                  <Plus size={16} weight="bold" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {editedUser.trainerProfile.authorizedRoles.map(role => (
                  <Badge key={role} variant="default" className="text-sm px-3 py-1">
                    {role}
                    <button
                      onClick={() => removeAuthorizedRole(role)}
                      className="ml-2 hover:text-destructive"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
                {editedUser.trainerProfile.authorizedRoles.length === 0 && (
                  <p className="text-sm text-muted-foreground">No authorized roles configured</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Specializations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Add specialization (e.g., 'Advanced Forklift Operations')"
                  value={newSpecialization}
                  onChange={(e) => setNewSpecialization(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addSpecialization()}
                />
                <Button onClick={addSpecialization}>
                  <Plus size={16} weight="bold" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {editedUser.trainerProfile.specializations.map(spec => (
                  <Badge key={spec} variant="secondary" className="text-sm px-3 py-1">
                    {spec}
                    <button
                      onClick={() => removeSpecialization(spec)}
                      className="ml-2 hover:text-destructive"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
                {editedUser.trainerProfile.specializations.length === 0 && (
                  <p className="text-sm text-muted-foreground">No specializations configured</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Additional Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Max Weekly Hours (Optional)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 40"
                  value={editedUser.trainerProfile.maxWeeklyHours || ''}
                  onChange={(e) =>
                    setEditedUser({
                      ...editedUser,
                      trainerProfile: {
                        ...editedUser.trainerProfile!,
                        maxWeeklyHours: e.target.value ? parseInt(e.target.value) : undefined,
                      },
                    })
                  }
                />
              </div>

              <div>
                <Label>Preferred Location (Optional)</Label>
                <Input
                  placeholder="e.g., Building A, Room 101"
                  value={editedUser.trainerProfile.preferredLocation || ''}
                  onChange={(e) =>
                    setEditedUser({
                      ...editedUser,
                      trainerProfile: {
                        ...editedUser.trainerProfile!,
                        preferredLocation: e.target.value,
                      },
                    })
                  }
                />
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  placeholder="Additional notes about this trainer..."
                  value={editedUser.trainerProfile.notes || ''}
                  onChange={(e) =>
                    setEditedUser({
                      ...editedUser,
                      trainerProfile: {
                        ...editedUser.trainerProfile!,
                        notes: e.target.value,
                      },
                    })
                  }
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
