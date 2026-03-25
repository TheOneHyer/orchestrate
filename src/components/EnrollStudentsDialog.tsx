import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
 * Dialog for searching and enrolling students into a training session.
 *
 * Displays a searchable, scrollable list of available students (excluding those already
 * enrolled). As students are selected, scheduling conflicts are detected in real time via
 * `checkStudentEnrollmentConflicts`. Conflicting students are highlighted and excluded from
 * the final enrollment call. The dialog also enforces the session's remaining capacity.
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

  const conflictCheck = useMemo(() => {
    if (selectedStudents.length === 0) {
      return { hasConflicts: false, conflicts: [], allowedStudents: [] }
    }
    return checkStudentEnrollmentConflicts(session, selectedStudents, allSessions, availableStudents)
  }, [session, selectedStudents, allSessions, availableStudents])

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    )
    setShowConflicts(true)
  }

  const handleSelectAll = () => {
    if (selectedStudents.length === filteredStudents.length) {
      setSelectedStudents([])
    } else {
      setSelectedStudents(filteredStudents.map(s => s.id))
      setShowConflicts(true)
    }
  }

  const addMatchedStudents = (studentIds: string[]) => {
    if (studentIds.length === 0) {
      return
    }

    setSelectedStudents((previous) => Array.from(new Set([...previous, ...studentIds])))
    setShowConflicts(true)
  }

  const handleImportIdentifiers = () => {
    const identifiers = parseEnrollmentIdentifiers(bulkIdentifiers)
    const { matchedIds, unmatched } = matchStudentsByIdentifiers(identifiers, filteredStudents)

    addMatchedStudents(matchedIds)

    if (matchedIds.length === 0 && unmatched.length === 0) {
      setImportSummary('Enter at least one student ID, email, or full name to import.')
      return
    }

    if (matchedIds.length === 0) {
      setImportSummary(`No matching students found. Unmatched: ${unmatched.join(', ')}`)
      return
    }

    const unmatchedMessage = unmatched.length > 0 ? ` Unmatched: ${unmatched.join(', ')}.` : ''
    setImportSummary(`Added ${matchedIds.length} student${matchedIds.length === 1 ? '' : 's'} from bulk upload.${unmatchedMessage}`)
  }

  const handleBadgeScan = () => {
    const identifiers = parseEnrollmentIdentifiers(badgeScanValue)
    const { matchedIds, unmatched } = matchStudentsByIdentifiers(identifiers, filteredStudents)

    addMatchedStudents(matchedIds)

    if (matchedIds.length > 0) {
      setImportSummary(`Badge scan matched ${matchedIds.length} student${matchedIds.length === 1 ? '' : 's'}.`)
      setBadgeScanValue('')
      return
    }

    setImportSummary(unmatched.length > 0
      ? `No student matched badge value: ${unmatched.join(', ')}`
      : 'Scan a student badge ID, email, or email username to add them.')
  }

  const handleEnroll = () => {
    if (conflictCheck.hasConflicts) {
      onEnrollStudents(conflictCheck.allowedStudents)
    } else {
      onEnrollStudents(selectedStudents)
    }
    setSelectedStudents([])
    setSearchQuery('')
    setShowConflicts(false)
    setBulkIdentifiers('')
    setBadgeScanValue('')
    setImportSummary(null)
    onOpenChange(false)
  }

  const handleCancel = () => {
    setSelectedStudents([])
    setSearchQuery('')
    setShowConflicts(false)
    setBulkIdentifiers('')
    setBadgeScanValue('')
    setImportSummary(null)
    onOpenChange(false)
  }

  /**
   * Looks up a student by ID from the `availableStudents` prop array.
   *
   * @param id - The user ID to search for.
   * @returns The matching {@link User} or `undefined` if not found.
   */
  const getStudentById = (id: string) => {
    return availableStudents.find(s => s.id === id)
  }

  const enrollableCount = conflictCheck.hasConflicts
    ? conflictCheck.allowedStudents.length
    : selectedStudents.length

  const remainingCapacity = session.capacity - session.enrolledStudents.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus size={24} />
            Enroll Students
          </DialogTitle>
          <DialogDescription>
            Add students to {session.title} on {format(new Date(session.startTime), 'MMM d, yyyy h:mm a')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
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
              {selectedStudents.length === filteredStudents.length ? 'Deselect All' : 'Select All'}
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
                <div className="font-medium">Bulk Upload</div>
                <div className="text-sm text-muted-foreground">Paste student IDs, emails, or full names separated by commas or new lines.</div>
              </div>
              <Textarea
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
                <div className="font-medium">Badge Scan</div>
                <div className="text-sm text-muted-foreground">Simulate a badge scan with a student ID, email, or email username.</div>
              </div>
              <Input
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

          <ScrollArea className="flex-1 -mx-6 px-6">
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
