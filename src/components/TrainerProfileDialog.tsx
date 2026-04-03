import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { User, ShiftSchedule, DayOfWeek, CertificationRecord } from '@/lib/types'
import { Plus, Trash, Clock, Calendar, Certificate } from '@phosphor-icons/react'
import { differenceInDays, differenceInMonths, differenceInYears, format, parseISO } from 'date-fns'
import { ManageCertificationsDialog } from '@/components/ManageCertificationsDialog'
import { calculateCertificationStatus } from '@/lib/certification-tracker'

/**
 * Props for the {@link TrainerProfileDialog} component.
 */
interface TrainerProfileDialogProps {
  /** The trainer user whose profile is being edited. */
  user: User
  /** Whether the dialog is open. */
  open: boolean
  /** Callback to update the open state of the dialog. */
  onOpenChange: (open: boolean) => void
  /**
   * Callback invoked with the updated user object when the user clicks "Save Changes".
   * @param user - The fully updated user, including all trainer profile edits.
   */
  onSave: (user: User) => void
}

/** All days of the week with their full label, used to build the "Days Worked" checkbox group. */
const DAYS_OF_WEEK: { value: DayOfWeek; label: string }[] = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
]

/**
 * Renders a modal dialog for viewing and editing a trainer's profile (shift schedules, authorized roles,
 * specializations, certifications, and additional settings).
 *
 * Edits are kept in local component state and are applied to the parent via `onSave` when the user saves.
 * When opened and the user lacks a `trainerProfile`, a minimal profile is scaffolded from the user's hire date.
 *
 * @param user - The trainer being edited.
 * @param open - Controls whether the dialog is visible.
 * @param onOpenChange - Called with the new open state when the dialog is opened or closed.
 * @param onSave - Called with the committed user object when the user saves changes.
 * @returns The Trainer Profile dialog element.
 * @throws {RangeError} If an invalid hire date reaches date formatting calculations.
 */
export function TrainerProfileDialog({ user, open, onOpenChange, onSave }: TrainerProfileDialogProps) {
  const [editedUser, setEditedUser] = useState<User>(user)
  const prevOpenRef = useRef(false)

  useEffect(() => {
    const wasOpen = prevOpenRef.current
    prevOpenRef.current = open

    // Only reset editedUser when the dialog transitions from closed to open,
    // so unsaved edits are discarded on reopen without causing extra renders
    // on every user prop reference change.
    if (!open || wasOpen) return

    const now = new Date()
    // TODO: Add isValid(parseISO(user.hireDate)) guard if hire dates can come from external/untrusted sources.
    const hireDate = parseISO(user.hireDate)

    if (user.trainerProfile) {
      setEditedUser(user)
    } else {
      const yearsOfService = differenceInYears(now, hireDate)
      const monthsOfService = differenceInMonths(now, hireDate)

      setEditedUser({
        ...user,
        trainerProfile: {
          authorizedRoles: [],
          shiftSchedules: [],
          tenure: {
            hireDate: user.hireDate,
            yearsOfService,
            monthsOfService,
          },
          specializations: [],
        },
      })
    }
  }, [open, user])
  const [newRole, setNewRole] = useState('')
  const [newSpecialization, setNewSpecialization] = useState('')
  const [certDialogOpen, setCertDialogOpen] = useState(false)

  /**
   * Calculates the total hours worked per week for a shift schedule.
   *
   * Handles overnight shifts (end time < start time) by adding 24 hours to the duration.
   *
   * @param schedule - The shift schedule to evaluate.
   * @returns Total hours per week (shift duration × number of days worked).
   */
  const calculateHoursPerWeek = (schedule: ShiftSchedule): number => {
    const [startHour, startMinute] = schedule.startTime.split(':').map(Number)
    const [endHour, endMinute] = schedule.endTime.split(':').map(Number)

    const startTotalMinutes = startHour * 60 + startMinute
    const endTotalMinutes = endHour * 60 + endMinute

    let durationMinutes = endTotalMinutes - startTotalMinutes

    if (durationMinutes < 0) {
      durationMinutes += 24 * 60
    }

    const hoursPerDay = durationMinutes / 60

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

  /**
   * Merges partial updates into the shift schedule at the given index and recalculates weekly hours.
   *
   * @param index - Index of the shift schedule to update.
   * @param updates - Partial shift schedule fields to apply.
   */
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

  const handleCertificationsSave = (certifications: CertificationRecord[]) => {
    if (!editedUser.trainerProfile) return

    setEditedUser({
      ...editedUser,
      trainerProfile: {
        ...editedUser.trainerProfile,
        certificationRecords: certifications
      }
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'expiring-soon':
        return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'expired':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
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
                    {format(parseISO(editedUser.trainerProfile.tenure.hireDate), 'MMM d, yyyy')}
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
                        <div className="grid grid-cols-2 gap-4 flex-1">
                          <div>
                            <Label>Shift Code</Label>
                            <Input
                              value={schedule.shiftCode}
                              onChange={(e) => updateShiftSchedule(index, { shiftCode: e.target.value })}
                              placeholder="e.g., SHIFT-A"
                            />
                          </div>
                          <div className="flex items-end justify-end">
                            <Button
                              variant="destructive"
                              size="sm"
                              aria-label={`Remove schedule ${index + 1}`}
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
                            aria-label={`Schedule ${index + 1} start time`}
                            value={schedule.startTime}
                            onChange={(e) => updateShiftSchedule(index, { startTime: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>End Time</Label>
                          <Input
                            type="time"
                            aria-label={`Schedule ${index + 1} end time`}
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
                  <span className="sr-only">Add role</span>
                  <Plus size={16} weight="bold" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {editedUser.trainerProfile.authorizedRoles.map(role => (
                  <Badge key={role} variant="default" className="text-sm px-3 py-1">
                    {role}
                    <button
                      type="button"
                      aria-label={`Remove authorized role ${role}`}
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
                  <span className="sr-only">Add specialization</span>
                  <Plus size={16} weight="bold" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {editedUser.trainerProfile.specializations.map(spec => (
                  <Badge key={spec} variant="secondary" className="text-sm px-3 py-1">
                    {spec}
                    <button
                      type="button"
                      aria-label={`Remove specialization ${spec}`}
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Certificate size={20} />
                  Certifications
                </CardTitle>
                <Button size="sm" onClick={() => setCertDialogOpen(true)}>
                  <Plus size={16} weight="bold" className="mr-1" />
                  Manage Certifications
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!editedUser.trainerProfile.certificationRecords || editedUser.trainerProfile.certificationRecords.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Certificate size={32} weight="duotone" className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No certification records</p>
                  <p className="text-xs mt-1">Click "Manage Certifications" to add certification records with expiration tracking</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {editedUser.trainerProfile.certificationRecords.map((cert, index) => {
                    const status = calculateCertificationStatus(cert)
                    const daysUntil = differenceInDays(parseISO(cert.expirationDate), new Date())

                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{cert.certificationName}</p>
                            {cert.renewalInProgress && (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                Renewal in Progress
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Expires: {format(parseISO(cert.expirationDate), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <Badge className={getStatusColor(status)} data-status={status}>
                          {status === 'expired' && 'Expired'}
                          {status === 'expiring-soon' && `${daysUntil}d left`}
                          {status === 'active' && 'Active'}
                          {status !== 'expired' && status !== 'expiring-soon' && status !== 'active' && 'Unknown'}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )}
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

      <ManageCertificationsDialog
        open={certDialogOpen}
        onOpenChange={setCertDialogOpen}
        certifications={editedUser.trainerProfile?.certificationRecords || []}
        onSave={handleCertificationsSave}
      />
    </Dialog>
  )
}
