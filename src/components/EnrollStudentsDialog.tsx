import { useCallback, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { User, Session } from '@/lib/types'
import { checkStudentEnrollmentConflicts } from '@/lib/conflict-detection'
import { matchStudentsByIdentifiers, parseEnrollmentIdentifiers } from '@/lib/enrollment-import'
import { MagnifyingGlass, Warning, UserPlus, Clock } from '@phosphor-icons/react'
import { format } from 'date-fns'

/**
 * Props for the {@link EnrollStudentsDialog} component.
 */
interface EnrollStudentsDialogProps {
  /** Whether the dialog is open. */
  open: boolean
  /** Callback to update the open state of the dialog. */
  onOpenChange: (open: boolean) => void
  /** The session into which students will be enrolled. */
  session: Session
  /** All sessions in the system, used for conflict detection. */
  allSessions: Session[]
  /** Users who are eligible for enrollment (typically employees not yet enrolled). */
  availableStudents: User[]
  /**
   * Callback invoked with the IDs of students to enroll when the user confirms.
   * When there are scheduling conflicts, only conflict-free student IDs are included.
   * @param studentIds - Array of student IDs to enroll in the session.
   */
  onEnrollStudents: (studentIds: string[]) => void
}

/**
 * Dialog UI for searching, selecting, and enrolling students into a training session.
 *
 * Renders a searchable, scrollable list of available students (excluding those already enrolled),
 * supports bulk import and badge-scan entry, highlights scheduling conflicts in real time, and
 * enforces the session's remaining capacity. When enrollment is confirmed, the component invokes
 * `onEnrollStudents` with only the student IDs that can be enrolled (conflict-free and within capacity).
 */
export function EnrollStudentsDialog({
  open,
  onOpenChange,
  session,
  allSessions,
  availableStudents,
  onEnrollStudents
}: EnrollStudentsDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [showConflicts, setShowConflicts] = useState(false)
  const [bulkIdentifiers, setBulkIdentifiers] = useState('')
  const [badgeScanValue, setBadgeScanValue] = useState('')
  const [importSummary, setImportSummary] = useState<string | null>(null)

  const filteredStudents = useMemo(() => {
    return availableStudents.filter(student =>
      !session.enrolledStudents.includes(student.id) &&
      (student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.department.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  }, [availableStudents, session.enrolledStudents, searchQuery])

  const visibleStudentIds = useMemo(() => {
    return filteredStudents.map((student) => student.id)
  }, [filteredStudents])

  const allVisibleSelected = visibleStudentIds.length > 0 && visibleStudentIds.every((id) => selectedStudents.includes(id))

  const conflictCheck = useMemo(() => {
    if (selectedStudents.length === 0) {
      return { hasConflicts: false, conflicts: [], allowedStudents: [] }
    }
    return checkStudentEnrollmentConflicts(session, selectedStudents, allSessions, availableStudents)
  }, [session, selectedStudents, allSessions, availableStudents])

  /**
   * Toggles a student's selection state.
   *
   * @param studentId - The ID of the student to toggle.
   */
  const handleToggleStudent = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    )
    setShowConflicts(true)
  }

  /** Selects all currently visible students, or deselects them if all are already selected. */
  const handleSelectAll = () => {
    if (visibleStudentIds.length === 0) {
      return
    }

    setSelectedStudents((previous) => {
      const everyVisibleSelected = visibleStudentIds.every((id) => previous.includes(id))
      if (everyVisibleSelected) {
        return previous.filter((id) => !visibleStudentIds.includes(id))
      }

      setShowConflicts(true)
      return Array.from(new Set([...previous, ...visibleStudentIds]))
    })
  }

  const resetTransientState = useCallback(() => {
    setSelectedStudents([])
    setSearchQuery('')
    setShowConflicts(false)
    setBulkIdentifiers('')
    setBadgeScanValue('')
    setImportSummary(null)
  }, [])

  /**
   * Adds a list of matched student IDs to the current selection.
   *
   * @param studentIds - The IDs to add; no-op when the array is empty.
   */
  const addMatchedStudents = (studentIds: string[]) => {
    if (studentIds.length === 0) {
      return
    }

    setSelectedStudents((previous) => Array.from(new Set([...previous, ...studentIds])))
    setShowConflicts(true)
  }

  /** Parses the bulk-identifiers text area and adds all matched, un-enrolled students to the selection. */
  const handleImportIdentifiers = () => {
    const identifiers = parseEnrollmentIdentifiers(bulkIdentifiers)
    const { matchedIds, unmatched } = matchStudentsByIdentifiers(identifiers, availableStudents)

    const enrolledStudentIds = new Set(session.enrolledStudents ?? [])
    const filteredMatchedIds = matchedIds.filter((id) => !enrolledStudentIds.has(id))

    addMatchedStudents(filteredMatchedIds)

    if (filteredMatchedIds.length === 0 && unmatched.length === 0 && matchedIds.length === 0) {
      setImportSummary('Enter at least one student ID, email, or full name to import.')
      return
    }

    if (filteredMatchedIds.length === 0 && matchedIds.length === 0) {
      setImportSummary(`No matching students found. Unmatched: ${unmatched.join(', ')}`)
      return
    }

    if (matchedIds.length > 0 && filteredMatchedIds.length === 0) {
      const unmatchedMessage = unmatched.length > 0 ? ` Unmatched: ${unmatched.join(', ')}.` : ''
      setImportSummary(`All matching students are already enrolled in this session.${unmatchedMessage}`)
      return
    }

    const unmatchedMessage = unmatched.length > 0 ? ` Unmatched: ${unmatched.join(', ')}.` : ''
    setImportSummary(`Added ${filteredMatchedIds.length} student${filteredMatchedIds.length === 1 ? '' : 's'} from bulk upload.${unmatchedMessage}`)
  }

  /** Processes the badge scan input field and adds the matched student to the selection. */
  const handleBadgeScan = () => {
    const identifiers = parseEnrollmentIdentifiers(badgeScanValue)
    const { matchedIds, unmatched } = matchStudentsByIdentifiers(identifiers, availableStudents)

    const enrolledStudentIds = new Set(session.enrolledStudents ?? [])
    const filteredMatchedIds = matchedIds.filter((id) => !enrolledStudentIds.has(id))

    addMatchedStudents(filteredMatchedIds)

    if (filteredMatchedIds.length > 0) {
      setImportSummary(`Badge scan matched ${filteredMatchedIds.length} student${filteredMatchedIds.length === 1 ? '' : 's'}.`)
      setBadgeScanValue('')
      return
    }

    if (matchedIds.length > 0 && filteredMatchedIds.length === 0) {
      setImportSummary('Scanned student is already enrolled in this session.')
      setBadgeScanValue('')
      return
    }
    setImportSummary(unmatched.length > 0
      ? `No student matched badge value: ${unmatched.join(', ')}`
      : 'Scan a student badge ID, email, or email username to add them.')
  }

  /** Enrolls the selected students, skipping those with conflicts, and closes the dialog. */
  const handleEnroll = () => {
    if (conflictCheck.hasConflicts) {
      onEnrollStudents(conflictCheck.allowedStudents)
    } else {
      onEnrollStudents(selectedStudents)
    }
    resetTransientState()
    onOpenChange(false)
  }

  /** Resets transient state and closes the dialog without enrolling anyone. */
  const handleCancel = () => {
    resetTransientState()
    onOpenChange(false)
  }

  /**
   * Handles controlled open/close state changes for the dialog.
   *
   * @param nextOpen - Whether the dialog should be open.
   */
  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetTransientState()
    }
    onOpenChange(nextOpen)
  }

  const enrollableCount = conflictCheck.hasConflicts
    ? conflictCheck.allowedStudents.length
    : selectedStudents.length

  const remainingCapacity = session.capacity - session.enrolledStudents.length

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus size={24} />
            Enroll Students
          </DialogTitle>
          <DialogDescription>
            Add students to {session.title} on {format(new Date(session.startTime), 'MMM d, yyyy h:mm a')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              {allVisibleSelected ? 'Deselect All' : 'Select All'}
            </Button>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {selectedStudents.length} selected · {filteredStudents.length} available
            </span>
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-muted-foreground" />
              <span className="text-muted-foreground">
                Capacity: {session.enrolledStudents.length + enrollableCount}/{session.capacity}
              </span>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-2 rounded-lg border p-3">
              <div>
                <Label htmlFor="bulk-identifiers" className="font-medium">Bulk Upload</Label>
                <div id="bulk-identifiers-help" className="text-sm text-muted-foreground">Paste student IDs, emails, or full names separated by commas or new lines.</div>
              </div>
              <Textarea
                id="bulk-identifiers"
                aria-describedby="bulk-identifiers-help"
                value={bulkIdentifiers}
                onChange={(event) => setBulkIdentifiers(event.target.value)}
                placeholder="stu-1\nstu-2\nalice@example.com"
              />
              <Button type="button" variant="outline" onClick={handleImportIdentifiers}>
                Import List
              </Button>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <div>
                <Label htmlFor="badge-scan-value" className="font-medium">Badge Scan</Label>
                <div id="badge-scan-help" className="text-sm text-muted-foreground">Simulate a badge scan with a student ID, email, or email username.</div>
              </div>
              <Input
                id="badge-scan-value"
                aria-describedby="badge-scan-help"
                value={badgeScanValue}
                onChange={(event) => setBadgeScanValue(event.target.value)}
                placeholder="Scan or enter badge value"
              />
              <Button type="button" variant="outline" onClick={handleBadgeScan}>
                Scan Badge
              </Button>
            </div>
          </div>

          {importSummary && (
            <Alert>
              <AlertDescription>{importSummary}</AlertDescription>
            </Alert>
          )}

          {remainingCapacity < enrollableCount && (
            <Alert variant="destructive">
              <Warning size={18} />
              <AlertDescription>
                Session capacity exceeded. Only {remainingCapacity} spots available, but {enrollableCount} students selected.
              </AlertDescription>
            </Alert>
          )}

          {showConflicts && conflictCheck.hasConflicts && (
            <Alert variant="destructive">
              <Warning size={18} />
              <AlertDescription>
                <div className="space-y-1">
                  <div className="font-medium">
                    {conflictCheck.conflicts.length} student{conflictCheck.conflicts.length > 1 ? 's have' : ' has'} scheduling conflicts:
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {conflictCheck.conflicts.slice(0, 3).map((conflict, idx) => (
                      <li key={idx}>
                        {conflict.studentName} → {conflict.conflictingSession.title}
                      </li>
                    ))}
                    {conflictCheck.conflicts.length > 3 && (
                      <li className="text-muted-foreground">
                        and {conflictCheck.conflicts.length - 3} more...
                      </li>
                    )}
                  </ul>
                  {conflictCheck.allowedStudents.length > 0 && (
                    <div className="mt-2 text-sm">
                      {conflictCheck.allowedStudents.length} student{conflictCheck.allowedStudents.length > 1 ? 's' : ''} can still be enrolled.
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
            <div className="space-y-2">
              {filteredStudents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? 'No students found matching your search.' : 'No students available to enroll.'}
                </div>
              ) : (
                filteredStudents.map(student => {
                  const isSelected = selectedStudents.includes(student.id)
                  const hasConflict = conflictCheck.conflicts.some(c => c.studentId === student.id)
                  const conflict = conflictCheck.conflicts.find(c => c.studentId === student.id)

                  return (
                    <div
                      key={student.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${isSelected
                        ? hasConflict
                          ? 'bg-destructive/5 border-destructive'
                          : 'bg-primary/5 border-primary'
                        : 'hover:bg-muted/50'
                        }`}
                    >
                      <Checkbox
                        id={student.id}
                        checked={isSelected}
                        onCheckedChange={() => handleToggleStudent(student.id)}
                        className="mt-1"
                      />
                      <label
                        htmlFor={student.id}
                        className="flex-1 cursor-pointer space-y-1"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium">{student.name}</div>
                            <div className="text-sm text-muted-foreground">{student.email}</div>
                          </div>
                          <Badge variant="outline">{student.department}</Badge>
                        </div>
                        {isSelected && hasConflict && conflict && (
                          <div className="flex items-center gap-2 text-sm text-destructive">
                            <Warning size={14} />
                            <span>Conflict: {conflict.conflictingSession.title}</span>
                          </div>
                        )}
                      </label>
                    </div>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleEnroll}
            disabled={selectedStudents.length === 0 || (conflictCheck.hasConflicts && conflictCheck.allowedStudents.length === 0) || remainingCapacity < enrollableCount}
          >
            Enroll {enrollableCount > 0 ? `${enrollableCount} Student${enrollableCount > 1 ? 's' : ''}` : 'Students'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
