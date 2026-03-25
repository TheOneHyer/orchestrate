import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash } from '@phosphor-icons/react'
import { ScheduleTemplate, ScheduleTemplateSession, ShiftType, TemplateRecurrenceType } from '@/lib/types'
import { Card } from '@/components/ui/card'

/**
 * Props for the {@link ScheduleTemplateDialog} component.
 */
interface ScheduleTemplateDialogProps {
  /** Whether the dialog is open. */
  open: boolean
  /** Callback to update the open state of the dialog. */
  onOpenChange: (open: boolean) => void
  /** When provided, the dialog operates in edit mode and pre-populates its fields from this template. */
  template?: ScheduleTemplate | null
  /**
   * Callback invoked with the template data when the user saves.
   * @param template - The new or updated template without server-managed fields.
   */
  onSave: (template: Omit<ScheduleTemplate, 'id' | 'createdAt' | 'createdBy' | 'lastUsed' | 'usageCount'>) => void
  /** Available courses to optionally associate with the template. */
  courses: Array<{ id: string; title: string }>
}

/** Ordered list of day names used to populate the "Day of Week" selector for template sessions. */
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/**
 * Dialog for creating or editing a reusable {@link ScheduleTemplate}.
 *
 * Lets the user define a template name, description, optional course association, category,
 * recurrence type, tags, and one or more session slots (each with a day-of-week, time,
 * duration, shift, capacity, and optional location). Handles both create and edit modes;
 * in edit mode the form is pre-populated from the `template` prop.
 */
export function ScheduleTemplateDialog({ open, onOpenChange, template, onSave, courses }: ScheduleTemplateDialogProps) {
  const [name, setName] = useState(template?.name || '')
  const [description, setDescription] = useState(template?.description || '')
  const [courseId, setCourseId] = useState(template?.courseId || '')
  const [category, setCategory] = useState(template?.category || 'general')
  const [recurrenceType, setRecurrenceType] = useState<TemplateRecurrenceType>(template?.recurrenceType || 'weekly')
  const [cycleDays, setCycleDays] = useState(template?.cycleDays?.toString() || '7')
  const [autoAssignTrainers, setAutoAssignTrainers] = useState(template?.autoAssignTrainers ?? true)
  const [notifyParticipants, setNotifyParticipants] = useState(template?.notifyParticipants ?? true)
  const [tags, setTags] = useState<string[]>(template?.tags || [])
  const [tagInput, setTagInput] = useState('')
  const [sessions, setSessions] = useState<ScheduleTemplateSession[]>(
    template?.sessions || [
      {
        dayOfWeek: 1,
        time: '09:00',
        duration: 120,
        shift: 'day',
        capacity: 20,
        requiresCertifications: []
      }
    ]
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
  }, [open])

  /** Appends a new default session to the template's session list. */
  const handleAddSession = () => {
    setSessions([
      ...sessions,
      {
        dayOfWeek: 1,
        time: '09:00',
        duration: 120,
        shift: 'day',
        capacity: 20,
        requiresCertifications: []
      }
    ])
  }

  /**
   * Removes the session at the given index from the template.
   *
   * @param index - Index of the session to remove.
   */
  const handleRemoveSession = (index: number) => {
    setSessions(sessions.filter((_, i) => i !== index))
  }

  /**
   * Merges partial updates into the session at the given index.
   *
   * @param index - Index of the session to update.
   * @param updates - Partial session fields to apply.
   */
  const handleUpdateSession = (index: number, updates: Partial<ScheduleTemplateSession>) => {
    setSessions(sessions.map((session, i) => (i === index ? { ...session, ...updates } : session)))
  }

  /** Adds the current tag input value to the template's tag list if it is non-empty and unique. */
  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  /**
   * Removes the given tag from the template's tag list.
   *
   * @param tag - The tag string to remove.
   */
  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag))
  }

  /** Validates required fields and invokes `onSave` with the assembled template data. */
  const handleSave = () => {
    setError(null)
    const parsedCycleDays = parseInt(cycleDays, 10)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Template name is required.')
      return
    }

    if (sessions.length === 0) {
      setError('At least one session is required.')
      return
    }

    if (recurrenceType === 'custom') {
      if (isNaN(parsedCycleDays) || parsedCycleDays <= 0) {
        setError('Cycle days must be a positive integer.')
        return
      }
    }

    onSave({
      name: trimmedName,
      description: description.trim(),
      courseId: courseId || undefined,
      category,
      recurrenceType,
      cycleDays: recurrenceType === 'custom' ? parsedCycleDays : undefined,
      sessions,
      autoAssignTrainers,
      notifyParticipants,
      tags,
      isActive: true
    })

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit Schedule Template' : 'Create Schedule Template'}</DialogTitle>
          <DialogDescription>
            Create a reusable template for recurring training schedules. Define sessions that will repeat on a regular basis.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="template-name">Template Name *</Label>
              <Input
                id="template-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., Weekly Safety Training"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="template-description">Description</Label>
              <Textarea
                id="template-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe when and how this template should be used..."
                rows={3}
              />
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col gap-2 flex-1">
                <Label htmlFor="template-course">Course (Optional)</Label>
                <Select value={courseId} onValueChange={setCourseId}>
                  <SelectTrigger id="template-course">
                    <SelectValue placeholder="Select course or leave unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map(course => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2 flex-1">
                <Label htmlFor="template-category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="template-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="safety">Safety</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="technical">Technical Skills</SelectItem>
                    <SelectItem value="leadership">Leadership</SelectItem>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                    <SelectItem value="certification">Certification</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col gap-2 flex-1">
                <Label htmlFor="template-recurrence">Recurrence Type</Label>
                <Select value={recurrenceType} onValueChange={(v) => setRecurrenceType(v as TemplateRecurrenceType)}>
                  <SelectTrigger id="template-recurrence">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Biweekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {recurrenceType === 'custom' && (
                <div className="flex flex-col gap-2 flex-1">
                  <Label htmlFor="template-cycle-days">Cycle Duration (Days)</Label>
                  <Input
                    id="template-cycle-days"
                    type="number"
                    min="1"
                    value={cycleDays}
                    onChange={e => setCycleDays(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label>Tags</Label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  placeholder="Add a tag..."
                />
                <Button type="button" onClick={handleAddTag} size="sm">
                  <Plus size={16} />
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)} className="ml-1 hover:text-destructive">
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="auto-assign">Auto-assign Trainers</Label>
                  <span className="text-xs text-muted-foreground">
                    Automatically match trainers based on certifications and availability
                  </span>
                </div>
                <Switch id="auto-assign" checked={autoAssignTrainers} onCheckedChange={setAutoAssignTrainers} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="notify-participants">Notify Participants</Label>
                  <span className="text-xs text-muted-foreground">Send notifications when sessions are created</span>
                </div>
                <Switch id="notify-participants" checked={notifyParticipants} onCheckedChange={setNotifyParticipants} />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label>Template Sessions *</Label>
              <Button type="button" onClick={handleAddSession} size="sm" variant="outline">
                <Plus size={16} className="mr-2" />
                Add Session
              </Button>
            </div>

            <div className="flex flex-col gap-3">
              {sessions.map((session, index) => (
                <Card key={index} className="p-4">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">Session {index + 1}</h4>
                      {sessions.length > 1 && (
                        <Button
                          type="button"
                          onClick={() => handleRemoveSession(index)}
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          aria-label={`Remove session ${index + 1}`}
                        >
                          <Trash size={16} />
                        </Button>
                      )}
                    </div>

                    <div className="flex gap-3">
                      {recurrenceType !== 'daily' && (
                        <div className="flex flex-col gap-2 flex-1">
                          <Label>Day of Week</Label>
                          <Select
                            value={session.dayOfWeek?.toString()}
                            onValueChange={v => handleUpdateSession(index, { dayOfWeek: parseInt(v) })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DAYS_OF_WEEK.map((day, i) => (
                                <SelectItem key={i} value={i.toString()}>
                                  {day}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="flex flex-col gap-2 flex-1">
                        <Label>Time</Label>
                        <Input
                          type="time"
                          value={session.time}
                          onChange={e => handleUpdateSession(index, { time: e.target.value })}
                        />
                      </div>

                      <div className="flex flex-col gap-2 flex-1">
                        <Label>Duration (min)</Label>
                        <Input
                          type="number"
                          min="15"
                          step="15"
                          value={session.duration}
                          aria-label={`Duration for session ${index + 1}`}
                          onChange={e => handleUpdateSession(index, { duration: parseInt(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex flex-col gap-2 flex-1">
                        <Label>Shift</Label>
                        <Select
                          value={session.shift}
                          onValueChange={v => handleUpdateSession(index, { shift: v as ShiftType })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="day">Day</SelectItem>
                            <SelectItem value="evening">Evening</SelectItem>
                            <SelectItem value="night">Night</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex flex-col gap-2 flex-1">
                        <Label>Capacity</Label>
                        <Input
                          type="number"
                          min="1"
                          value={session.capacity}
                          aria-label={`Capacity for session ${index + 1}`}
                          onChange={e => handleUpdateSession(index, { capacity: parseInt(e.target.value) })}
                        />
                      </div>

                      <div className="flex flex-col gap-2 flex-1">
                        <Label>Location (Optional)</Label>
                        <Input
                          value={session.location || ''}
                          onChange={e => handleUpdateSession(index, { location: e.target.value })}
                          placeholder="Room/Location"
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || sessions.length === 0}>
            {template ? 'Update Template' : 'Create Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
