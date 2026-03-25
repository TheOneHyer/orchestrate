import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle } from '@phosphor-icons/react'
import type { Course, Enrollment, User } from '@/lib/types'

/** Props for the RecordScoreDialog component. */
export interface RecordScoreDialogProps {
    /** Whether the dialog is open. */
    open: boolean
    /** Callback to open/close the dialog. */
    onOpenChange: (open: boolean) => void
    /** The enrollment record for which a score is being recorded. */
    enrollment: Enrollment
    /** The course this enrollment belongs to (used for pass score and title). */
    course: Course
    /** The enrolled student user (used to display their name). */
    student: User
    /** Callback invoked with the validated score when the user confirms. */
    onSubmit: (enrollmentId: string, score: number) => void
}

/**
 * Modal dialog that allows an admin or trainer to record a final assessment
 * score for a specific enrollment.
 *
 * Shows the student's name, course title, current status, and pass threshold.
 * Provides a numeric input (0–100) with real-time pass/fail preview. Calls
 * `onSubmit` with the enrollment ID and validated score on confirmation.
 *
 * @param open - Controls dialog visibility.
 * @param onOpenChange - Handler invoked when the dialog should open or close.
 * @param enrollment - The enrollment being scored.
 * @param course - The course associated with the enrollment.
 * @param student - The student whose score is being recorded.
 * @param onSubmit - Called with `(enrollmentId, score)` on successful submission.
 * @returns The rendered dialog element.
 */
export function RecordScoreDialog({
    open,
    onOpenChange,
    enrollment,
    course,
    student,
    onSubmit,
}: RecordScoreDialogProps) {
    const [rawValue, setRawValue] = useState(
        enrollment.score !== undefined ? String(enrollment.score) : '',
    )

    useEffect(() => {
        if (!open) {
            return
        }

        setRawValue(enrollment.score !== undefined ? String(enrollment.score) : '')
    }, [open, enrollment.id, enrollment.score])

    const parsedScore = rawValue === '' ? null : Number(rawValue)
    const isValid =
        parsedScore !== null &&
        Number.isFinite(parsedScore) &&
        Number.isInteger(parsedScore) &&
        parsedScore >= 0 &&
        parsedScore <= 100
    const wouldPass = isValid && parsedScore !== null && parsedScore >= course.passScore
    const wouldFail = isValid && !wouldPass

    function handleSubmit() {
        if (!isValid || parsedScore === null) {
            return
        }
        onSubmit(enrollment.id, parsedScore)
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Record Score</DialogTitle>
                    <DialogDescription>
                        Enter the final assessment score for this enrollment.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-1">
                        <div className="text-sm font-medium">{student.name}</div>
                        <div className="text-sm text-muted-foreground">{course.title}</div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Pass score:</span>
                        <Badge variant="outline">{course.passScore}%</Badge>
                        {enrollment.score !== undefined && (
                            <>
                                <span className="ml-2">Current:</span>
                                <Badge variant="secondary">{enrollment.score}%</Badge>
                            </>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="score-input">Score (0 – 100)</Label>
                        <Input
                            id="score-input"
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            placeholder="e.g. 85"
                            value={rawValue}
                            onChange={(e) => setRawValue(e.target.value)}
                        />

                        {isValid && (
                            <div
                                className={`flex items-center gap-1.5 text-sm font-medium ${wouldPass ? 'text-green-600' : 'text-red-600'}`}
                                data-testid="score-preview"
                            >
                                {wouldPass ? (
                                    <>
                                        <CheckCircle size={16} />
                                        Pass — enrollment will be marked Completed
                                    </>
                                ) : (
                                    <>
                                        <XCircle size={16} />
                                        {wouldFail ? 'Fail — enrollment will be marked Failed' : ''}
                                    </>
                                )}
                            </div>
                        )}

                        {rawValue !== '' && !isValid && (
                            <p className="text-sm text-red-600" data-testid="score-error">
                                Please enter a whole number between 0 and 100.
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={!isValid}>
                        Save Score
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
