import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle } from '@phosphor-icons/react'
import type { Course, Enrollment, User } from '@/lib/types'

const scoreSchema = z.object({
    score: z
        .number({ message: 'Please enter a whole number between 0 and 100.' })
        .int('Please enter a whole number between 0 and 100.')
        .min(0, 'Please enter a whole number between 0 and 100.')
        .max(100, 'Please enter a whole number between 0 and 100.')
        .optional(),
})

/** Form values inferred from the score validation schema. */
type ScoreFormValues = z.infer<typeof scoreSchema>

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
    const form = useForm<ScoreFormValues>({
        resolver: zodResolver(scoreSchema),
        defaultValues: {
            score: enrollment.score ?? undefined,
        },
        mode: 'onChange',
    })

    useEffect(() => {
        form.reset({ score: enrollment.score ?? undefined })
    }, [open, enrollment.id, enrollment.score, form.reset])

    const score = form.watch('score')
    const hasScore = typeof score === 'number'
    const isScoreValid = hasScore && Number.isInteger(score) && score >= 0 && score <= 100
    const canSubmit = isScoreValid
    const wouldPass = canSubmit && score >= course.passScore
    const wouldFail = canSubmit && !wouldPass

    /** Submits the validated score and closes the dialog. */
    function handleSubmit(values: ScoreFormValues) {
        if (values.score === undefined) {
            return
        }
        onSubmit(enrollment.id, values.score)
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
                <Form {...form}>
                    <form className="space-y-4 py-2" onSubmit={form.handleSubmit(handleSubmit)}>
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

                        <FormField
                            control={form.control}
                            name="score"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Score (0 - 100)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min={0}
                                            max={100}
                                            step={1}
                                            placeholder="e.g. 85"
                                            value={field.value ?? ''}
                                            onChange={(event) => {
                                                const nextValue = event.target.value
                                                field.onChange(nextValue === '' ? undefined : event.target.valueAsNumber)
                                            }}
                                        />
                                    </FormControl>
                                    <FormMessage data-testid="score-error" />
                                </FormItem>
                            )}
                        />

                        {canSubmit && (
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

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={!canSubmit}>
                                Save Score
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
