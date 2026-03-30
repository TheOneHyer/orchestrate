import { useEffect, useMemo, useRef, useState } from 'react'
import { Clock, GraduationCap, MagnifyingGlass, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { FieldErrors, useFieldArray, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createDefaultModuleContent, normalizeCourseModules, summarizeModuleTitles } from '@/lib/course-modules'
import { formatDuration } from '@/lib/helpers'
import { Course, Enrollment, Module, User } from '@/lib/types'

/** Form state shape used by the course editor dialog. */
interface CourseEditorState {
  title: string
  description: string
  duration: string
  passScore: string
  certifications: string
  published: boolean
  moduleDetails: Module[]
}

const courseEditorSchema = z.object({
  title: z.string().trim().min(1, 'Title and description are required.'),
  description: z.string().trim().min(1, 'Title and description are required.'),
  duration: z.coerce.number().int().positive('Duration must be a positive whole number in minutes.'),
  passScore: z.string().trim()
    .min(1, 'Pass score must be between 0 and 100.')
    .refine((value) => {
      const parsedValue = Number(value)
      return Number.isInteger(parsedValue) && parsedValue >= 0 && parsedValue <= 100
    }, 'Pass score must be between 0 and 100.'),
  certifications: z.string(),
  published: z.boolean(),
  moduleDetails: z.array(z.object({
    id: z.string().min(1),
    title: z.string().trim().min(1, 'Each module needs a title and positive duration.'),
    description: z.string(),
    contentType: z.enum(['text', 'video', 'slideshow', 'quiz']),
    content: z.custom<Module['content']>(),
    duration: z.coerce.number().int().positive('Each module needs a title and positive duration.'),
    order: z.number().int(),
  })).min(1, 'At least one module is required.'),
})

/**
 * Get the first human-readable validation message from the form errors.
 *
 * @param errors - React Hook Form `FieldErrors` for the course editor form
 * @returns The first found validation message string, or `Please review the course details and try again.` as a fallback
 */
export function getFirstValidationErrorMessage(errors: FieldErrors<CourseEditorState>): string {
  if (typeof errors.title?.message === 'string') {
    return errors.title.message
  }

  if (typeof errors.description?.message === 'string') {
    return errors.description.message
  }

  if (typeof errors.duration?.message === 'string') {
    return errors.duration.message
  }

  if (typeof errors.passScore?.message === 'string') {
    return errors.passScore.message
  }

  if (typeof errors.moduleDetails?.message === 'string') {
    return errors.moduleDetails.message
  }

  const moduleErrors = Array.isArray(errors.moduleDetails) ? errors.moduleDetails : []
  const firstModuleError = moduleErrors.find((moduleError) => {
    return typeof moduleError?.title?.message === 'string' || typeof moduleError?.duration?.message === 'string'
  })

  if (typeof firstModuleError?.title?.message === 'string') {
    return firstModuleError.title.message
  }

  if (typeof firstModuleError?.duration?.message === 'string') {
    return firstModuleError.duration.message
  }

  return 'Please review the course details and try again.'
}

const initialEditorState: CourseEditorState = {
  title: '',
  description: '',
  duration: '60',
  passScore: '80',
  certifications: '',
  published: false,
  moduleDetails: [],
}

/** Props for the Courses view component. */
interface CoursesProps {
  /** All available courses to display and filter. */
  courses: Course[]
  /** All enrollment records used to show per-course enrollment progress for the current user. */
  enrollments: Enrollment[]
  /** The currently authenticated user; determines whether admin/trainer actions are shown. */
  currentUser: User
  /** Navigation callback invoked with a view name and optional data when a card is clicked. */
  onNavigate: (view: string, data?: unknown) => void
  /** Optional callback invoked when a new course is created from this view; may complete asynchronously. */
  onCreateCourse?: (course: Omit<Course, 'id'>) => void | Promise<void>
  /** Optional callback invoked when an existing course is updated. */
  onUpdateCourse?: (id: string, updates: Partial<Course>) => void | Promise<void>
  /** Optional callback invoked when an existing course is deleted. */
  onDeleteCourse?: (id: string) => void | Promise<void>
  /** Optional navigation payload used to open create/detail interactions. */
  navigationPayload?: unknown
  /** Optional callback invoked after a navigation payload has been consumed. */
  onNavigationPayloadConsumed?: () => void
}

/**
 * Type guard for courses view navigation payload.
 *
 * @param value - Unknown payload to validate.
 * @returns True when payload contains `create` or `courseId` fields.
 */
function isCoursesNavigationPayload(value: unknown): value is { create?: boolean; courseId?: string } {
  if (!value || typeof value !== 'object') {
    return false
  }

  const payload = value as { create?: unknown; courseId?: unknown }
  const hasCreate = typeof payload.create === 'boolean'
  const hasCourseId = typeof payload.courseId === 'string'

  return hasCreate || hasCourseId
}

/**
 * Creates editable course state from a stored course.
 *
 * @param course - The course to transform.
 * @returns Dialog state used by the course editor.
 */
function createEditorStateFromCourse(course: Course): CourseEditorState {
  return {
    title: course.title,
    description: course.description,
    duration: String(course.duration),
    passScore: String(course.passScore),
    certifications: course.certifications.join(', '),
    published: course.published,
    moduleDetails: normalizeCourseModules(course),
  }
}

/**
 * Validates whether a module has meaningful content for its type.
 *
 * @param moduleItem - Module entry to validate.
 * @returns True when content is sufficiently populated.
 */
function validateModuleContentByType(moduleItem: Module): boolean {
  if (moduleItem.contentType === 'text') {
    return true
  }

  if (moduleItem.contentType === 'video') {
    const content = moduleItem.content as Extract<Module['content'], { url: string }>
    return content.url.trim().length > 0
  }

  if (moduleItem.contentType === 'slideshow') {
    const content = moduleItem.content as Extract<Module['content'], { slides: string[] }>
    return content.slides.some((slide) => slide.trim().length > 0)
  }

  const content = moduleItem.content as Extract<Module['content'], { questions: Array<{ prompt: string; choices: string[]; correctIndex: number }> }>
  if (content.questions.length === 0) {
    return false
  }

  return content.questions.every((question) => {
    if (question.prompt.trim().length === 0) {
      return false
    }

    const normalizedChoices = question.choices.map((choice) => choice.trim())
    const hasEnoughChoices = normalizedChoices.length >= 2
    const hasOnlyNonEmptyChoices = normalizedChoices.every((choice) => choice.length > 0)
    const hasValidCorrectIndex = Number.isInteger(question.correctIndex) && question.correctIndex >= 0 && question.correctIndex < normalizedChoices.length

    return hasEnoughChoices && hasOnlyNonEmptyChoices && hasValidCorrectIndex
  })
}

/**
 * Renders the Courses library view with filtering, publishing, and structured module editing.
 *
 * @param courses - All courses to display.
 * @param enrollments - Enrollment records used to render per-course progress.
 * @param currentUser - The authenticated user; role determines visible actions.
 * @param onNavigate - Navigation callback invoked on card click.
 * @param onCreateCourse - Optional course creation callback.
 * @param onUpdateCourse - Optional course update callback.
 * @param onDeleteCourse - Optional course deletion callback.
 * @param navigationPayload - Optional one-time payload used to open create or detail dialogs.
 * @param onNavigationPayloadConsumed - Optional callback invoked after payload processing.
 * @returns The rendered Courses page element.
 */
export function Courses({
  courses,
  enrollments,
  currentUser,
  onNavigate,
  onCreateCourse,
  onUpdateCourse,
  onDeleteCourse,
  navigationPayload,
  onNavigationPayloadConsumed,
}: CoursesProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all')
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [editorDialogOpen, setEditorDialogOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const processedPayloadRef = useRef<unknown>(null)
  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    getValues,
  } = useForm<CourseEditorState>({
    resolver: zodResolver(courseEditorSchema),
    defaultValues: initialEditorState,
    mode: 'onSubmit',
  })
  const { fields: moduleFields, append, remove, move, replace } = useFieldArray({
    control,
    name: 'moduleDetails',
  })
  const watchedModules = watch('moduleDetails')

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesQuery = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'published' ? course.published : !course.published)

      return matchesQuery && matchesStatus
    })
  }, [courses, searchQuery, statusFilter])

  useEffect(() => {
    if (processedPayloadRef.current === navigationPayload) {
      return
    }

    if (!isCoursesNavigationPayload(navigationPayload)) {
      processedPayloadRef.current = navigationPayload
      return
    }

    if (navigationPayload.create) {
      setEditingCourse(null)
      reset(initialEditorState)
      setEditorDialogOpen(true)
      processedPayloadRef.current = navigationPayload
      onNavigationPayloadConsumed?.()
      return
    }

    if (!navigationPayload.courseId) {
      processedPayloadRef.current = navigationPayload
      onNavigationPayloadConsumed?.()
      return
    }

    if (courses.length === 0) {
      return
    }

    const targetCourse = courses.find((course) => course.id === navigationPayload.courseId)
    if (!targetCourse) {
      toast.error('Course not found', {
        description: 'The selected course could not be opened.',
      })
      processedPayloadRef.current = navigationPayload
      onNavigationPayloadConsumed?.()
      return
    }

    setSelectedCourse(targetCourse)
    setDetailDialogOpen(true)
    processedPayloadRef.current = navigationPayload
    onNavigationPayloadConsumed?.()
  }, [courses, navigationPayload, onNavigationPayloadConsumed, reset])

  useEffect(() => {
    if (!selectedCourse) {
      return
    }

    if (courses.length === 0) {
      return
    }

    const latestCourse = courses.find((course) => course.id === selectedCourse.id)
    if (!latestCourse) {
      setSelectedCourse(null)
      setDetailDialogOpen(false)
      return
    }

    if (latestCourse !== selectedCourse) {
      setSelectedCourse(latestCourse)
    }
  }, [courses, selectedCourse])

  /**
   * Returns the enrollment record for the given course belonging to the current user, if any.
   *
   * @param courseId - The course ID to look up.
   * @returns The matching `Enrollment`, or `undefined` when none exists.
   */
  const getEnrollmentForCourse = (courseId: string) => {
    return enrollments.find((enrollment) => enrollment.courseId === courseId && enrollment.userId === currentUser.id)
  }

  const canCreateCourse = currentUser.role === 'admin' || currentUser.role === 'trainer'
  /** Returns `true` when the current user has permission to manage (edit/delete) the given course. */
  const canManageCourse = (course: Course) => currentUser.role === 'admin' || course.createdBy === currentUser.id

  /**
   * Navigates to the course detail view for the given course.
   *
   * @param course - The course to open.
   */
  const handleOpenCourse = (course: Course) => {
    onNavigate('courses', { courseId: course.id })
  }

  /**
   * Opens the course editor dialog, optionally pre-populated with an existing course.
   *
   * @param course - The course to edit; omit to open the editor for a new course.
   */
  const handleOpenEditor = (course?: Course) => {
    setDetailDialogOpen(false)
    setEditingCourse(course || null)
    reset(course ? createEditorStateFromCourse(course) : initialEditorState)
    setEditorDialogOpen(true)
  }

  /** Resets the editor form and closes the course editor dialog. */
  const handleCloseEditor = () => {
    reset(initialEditorState)
    setEditingCourse(null)
    setEditorDialogOpen(false)
  }

  /**
   * Merges partial updates into the module at the given index in the form.
   *
   * @param index - Index of the module to update.
   * @param updates - Partial module fields to apply.
   */
  const handleModuleChange = (index: number, updates: Partial<Module>) => {
    const currentModule = getValues(`moduleDetails.${index}`)
    if (!currentModule) {
      return
    }

    setValue(`moduleDetails.${index}`, { ...currentModule, ...updates }, { shouldDirty: true, shouldValidate: true })
  }

  /**
   * Updates the content type of the module at the given index and resets its content to the default for that type.
   *
   * @param index - Index of the module to update.
   * @param contentType - The new content type to apply.
   */
  const handleModuleContentTypeChange = (index: number, contentType: Module['contentType']) => {
    handleModuleChange(index, {
      contentType,
      content: createDefaultModuleContent(contentType),
    })
  }

  /** Appends a new default module to the course's module list. */
  const handleAddModule = () => {
    const currentModules = getValues('moduleDetails')
    append({
      id: `module-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: `Module ${currentModules.length + 1}`,
      description: '',
      contentType: 'text',
      content: createDefaultModuleContent('text'),
      duration: 15,
      order: currentModules.length,
    })
  }

  /**
   * Moves the module at the given index one step in the specified direction.
   *
   * @param index - Index of the module to move.
   * @param direction - `-1` to move up, `1` to move down.
   */
  const handleMoveModule = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= moduleFields.length) {
      return
    }

    move(index, nextIndex)
    const reordered = getValues('moduleDetails').map((entry, order) => ({ ...entry, order }))
    replace(reordered)
  }

  /**
   * Removes the module at the given index and reorders the remaining modules.
   *
   * @param index - Index of the module to remove.
   */
  const handleRemoveModule = (index: number) => {
    remove(index)
    const reordered = getValues('moduleDetails').map((moduleItem, order) => ({ ...moduleItem, order }))
    replace(reordered)
  }

  /**
   * Transforms the validated editor form values into a course data payload ready for persistence.
   *
   * @param values - Validated `CourseEditorState` form values.
   * @returns An object containing all normalized course fields.
   */
  const buildCoursePayload = (values: CourseEditorState) => {
    const title = values.title.trim()
    const description = values.description.trim()
    const duration = Number(values.duration)
    const passScoreRaw = values.passScore.trim()
    const passScore = Number(passScoreRaw)
    const certifications = values.certifications.split(',').map((value) => value.trim()).filter(Boolean)
    const moduleDetails = values.moduleDetails.map((moduleItem, order) => ({
      ...moduleItem,
      title: moduleItem.title.trim(),
      description: moduleItem.description.trim(),
      duration: Number(moduleItem.duration),
      order,
    }))

    const placeholderModule = moduleDetails.find((moduleItem) => !validateModuleContentByType(moduleItem))
    if (placeholderModule) {
      throw new Error(`Module content must be filled for module type ${placeholderModule.contentType}.`)
    }

    return {
      title,
      description,
      duration,
      passScore,
      certifications,
      published: values.published,
      modules: summarizeModuleTitles(moduleDetails),
      moduleDetails,
    }
  }

  const handleSaveCourse = handleSubmit(async (values) => {
    if (isSaving) {
      return
    }

    if (editingCourse) {
      if (!canManageCourse(editingCourse)) {
        toast.error('Course management unavailable', {
          description: 'You do not have permission to manage courses.',
        })
        return
      }

      if (!onUpdateCourse) {
        toast.error('Course update unavailable', {
          description: 'Update callback is not configured.',
        })
        return
      }
    } else {
      if (!canCreateCourse) {
        toast.error('Course management unavailable', {
          description: 'You do not have permission to manage courses.',
        })
        return
      }

      if (!onCreateCourse) {
        toast.error('Course creation unavailable', {
          description: 'Create callback is not configured.',
        })
        return
      }
    }

    let coursePayload: Omit<Course, 'id'> | Partial<Course>
    try {
      coursePayload = {
        ...buildCoursePayload(values),
        createdBy: editingCourse?.createdBy || currentUser.id,
        createdAt: editingCourse?.createdAt || new Date().toISOString(),
      }
    } catch (error) {
      toast.error('Course validation failed', {
        description: error instanceof Error ? error.message : 'Please review the course details and try again.',
      })
      return
    }

    setIsSaving(true)

    try {
      if (editingCourse) {
        await Promise.resolve(onUpdateCourse(editingCourse.id, { ...coursePayload, updatedAt: editingCourse.updatedAt }))
        toast.success('Course updated', {
          description: `${coursePayload.title} has been saved.`,
        })
      } else {
        await Promise.resolve(onCreateCourse(coursePayload as Omit<Course, 'id'>))
        toast.success('Course created', {
          description: `${coursePayload.title} has been added to the catalog.`,
        })
      }

      handleCloseEditor()
    } catch (error) {
      toast.error('Course save failed', {
        description: error instanceof Error && error.message
          ? error.message
          : 'Please try again after resolving the issue.',
      })
    } finally {
      setIsSaving(false)
    }
  }, (errors) => {
    toast.error('Course validation failed', {
      description: getFirstValidationErrorMessage(errors),
    })
  })

  /** Guards against missing permissions and callbacks before triggering the async course save. */
  const handleSaveButtonClick = () => {
    if (editingCourse) {
      if (!canManageCourse(editingCourse)) {
        toast.error('Course management unavailable', {
          description: 'You do not have permission to manage courses.',
        })
        return
      }

      if (!onUpdateCourse) {
        toast.error('Course update unavailable', {
          description: 'Update callback is not configured.',
        })
        return
      }
    } else {
      if (!canCreateCourse) {
        toast.error('Course management unavailable', {
          description: 'You do not have permission to manage courses.',
        })
        return
      }

      if (!onCreateCourse) {
        toast.error('Course creation unavailable', {
          description: 'Create callback is not configured.',
        })
        return
      }
    }

    void handleSaveCourse()
  }

  /** Confirms and deletes the currently selected course, also removing linked sessions. */
  const handleDeleteSelectedCourse = async () => {
    if (!selectedCourse || !onDeleteCourse || !canManageCourse(selectedCourse) || isDeleting) {
      return
    }

    const confirmed = window.confirm(`Delete ${selectedCourse.title}? Related sessions will also be removed.`)
    if (!confirmed) {
      return
    }

    setIsDeleting(true)

    try {
      await Promise.resolve(onDeleteCourse(selectedCourse.id))
      setDetailDialogOpen(false)
      setSelectedCourse(null)
      toast.success('Course deleted', {
        description: 'The course and its linked sessions have been removed.',
      })
    } catch (error) {
      toast.error('Delete failed', {
        description: error instanceof Error && error.message
          ? error.message
          : 'Please try again after resolving the issue.',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  /** Toggles the published state of the selected course and persists the change. */
  const handlePublishToggle = async () => {
    if (!selectedCourse || !onUpdateCourse || !canManageCourse(selectedCourse) || isPublishing) {
      return
    }

    const nextPublished = !selectedCourse.published

    setIsPublishing(true)

    try {
      await Promise.resolve(onUpdateCourse(selectedCourse.id, { published: nextPublished, updatedAt: selectedCourse.updatedAt }))
      toast.success(nextPublished ? 'Course published' : 'Course moved to draft', {
        description: `${selectedCourse.title} is now ${nextPublished ? 'available' : 'hidden from employees'} for scheduling.`,
      })
    } catch (error) {
      toast.error('Status update failed', {
        description: error instanceof Error && error.message
          ? error.message
          : 'Please try again after resolving the issue.',
      })
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Courses</h1>
          <p className="text-muted-foreground mt-1">Browse and manage training courses</p>
        </div>
        {canCreateCourse && (
          <Button onClick={() => handleOpenEditor()}>
            <Plus size={18} weight="bold" className="mr-2" />
            Create Course
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <div className="relative">
          <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | 'draft' | 'published')}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All courses</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredCourses.map((course) => {
          const enrollment = getEnrollmentForCourse(course.id)
          const moduleDetails = normalizeCourseModules(course)

          return (
            <Card
              key={course.id}
              className="cursor-pointer transition-shadow hover:shadow-lg"
              role="button"
              tabIndex={0}
              aria-label={`Open course ${course.title}`}
              onClick={() => handleOpenCourse(course)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  handleOpenCourse(course)
                }
              }}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <GraduationCap size={24} />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Badge variant={course.published ? 'default' : 'outline'}>{course.published ? 'Published' : 'Draft'}</Badge>
                    {canManageCourse(course) && <Badge variant="secondary">Owner</Badge>}
                  </div>
                </div>
                <CardTitle className="mt-3">{course.title}</CardTitle>
                <CardDescription className="line-clamp-2">{course.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock size={16} />
                    {formatDuration(course.duration)}
                  </span>
                  <span className="text-muted-foreground">
                    {moduleDetails.length} module{moduleDetails.length === 1 ? '' : 's'}
                  </span>
                </div>

                {course.certifications.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {course.certifications.slice(0, 2).map((certification) => (
                      <Badge key={certification} variant="secondary" className="text-xs">
                        {certification}
                      </Badge>
                    ))}
                    {course.certifications.length > 2 && (
                      <Badge variant="secondary" className="text-xs">
                        +{course.certifications.length - 2}
                      </Badge>
                    )}
                  </div>
                )}

                <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  {moduleDetails[0] ? `${moduleDetails[0].contentType.toUpperCase()} first module` : 'No modules yet'}
                  {moduleDetails[0] ? ` • ${moduleDetails[0].title}` : ''}
                </div>

                {enrollment && (
                  <div className="pt-2">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{enrollment.progress}%</span>
                    </div>
                    <Progress value={enrollment.progress} className="h-2" />
                    <Badge variant={enrollment.status === 'completed' ? 'default' : 'outline'} className="mt-2">
                      {enrollment.status}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredCourses.length === 0 && (
        <div className="text-center py-12">
          <GraduationCap size={64} className="mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No courses found</p>
        </div>
      )}

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedCourse?.title || 'Course details'}</DialogTitle>
            <DialogDescription>{selectedCourse?.description}</DialogDescription>
          </DialogHeader>
          {selectedCourse && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground">Duration</div>
                  <div className="font-medium">{formatDuration(selectedCourse.duration)}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground">Pass Score</div>
                  <div className="font-medium">{selectedCourse.passScore}%</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground">Modules</div>
                  <div className="font-medium">{normalizeCourseModules(selectedCourse).length}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground">Status</div>
                  <div className="font-medium">{selectedCourse.published ? 'Published' : 'Draft'}</div>
                </div>
              </div>

              {selectedCourse.certifications.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Certifications</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedCourse.certifications.map((certification) => (
                      <Badge key={certification} variant="secondary">{certification}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="text-sm font-medium">Modules</div>
                {normalizeCourseModules(selectedCourse).length === 0 ? (
                  <div className="text-sm text-muted-foreground">No modules defined.</div>
                ) : (
                  normalizeCourseModules(selectedCourse).map((moduleItem, index) => (
                    <div key={moduleItem.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{index + 1}. {moduleItem.title}</div>
                          <div className="text-sm text-muted-foreground">{moduleItem.description || 'No description provided.'}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{moduleItem.contentType}</Badge>
                          <Badge variant="secondary">{moduleItem.duration} min</Badge>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {canManageCourse(selectedCourse) && (
                <DialogFooter className="gap-2 sm:justify-between">
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => handleOpenEditor(selectedCourse)}>
                      <PencilSimple size={16} className="mr-2" />
                      Edit Course
                    </Button>
                    <Button variant={selectedCourse.published ? 'outline' : 'default'} onClick={handlePublishToggle} disabled={isPublishing}>
                      {isPublishing ? 'Updating...' : selectedCourse.published ? 'Move to Draft' : 'Publish Course'}
                    </Button>
                  </div>
                  {onDeleteCourse && (
                    <Button variant="destructive" onClick={handleDeleteSelectedCourse} disabled={isDeleting}>
                      <Trash size={16} className="mr-2" />
                      {isDeleting ? 'Deleting...' : 'Delete Course'}
                    </Button>
                  )}
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={editorDialogOpen}
        onOpenChange={(open) => {
          if (open || isSaving) {
            setEditorDialogOpen(true)
            return
          }

          handleCloseEditor()
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCourse ? 'Edit Course' : 'Create Course'}</DialogTitle>
            <DialogDescription>
              Build structured modules with typed content while preserving draft or published status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="course-title">Title</Label>
                <Input
                  id="course-title"
                  {...register('title')}
                  placeholder="e.g., Workplace Safety Basics"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="course-description">Description</Label>
                <Textarea
                  id="course-description"
                  {...register('description')}
                  placeholder="Briefly describe this course"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="course-duration">Duration (minutes)</Label>
                <Input
                  id="course-duration"
                  type="number"
                  min="1"
                  step="1"
                  {...register('duration')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="course-pass-score">Pass Score</Label>
                <Input
                  id="course-pass-score"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  {...register('passScore')}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="course-certifications">Certifications (comma-separated)</Label>
                <Input
                  id="course-certifications"
                  {...register('certifications')}
                  placeholder="Safety 101, OSHA Intro"
                />
              </div>
              <div className="flex items-center gap-3 md:col-span-2">
                <Checkbox
                  id="course-published"
                  checked={watch('published')}
                  onCheckedChange={(checked) => {
                    setValue('published', checked === true, { shouldDirty: true, shouldValidate: true })
                  }}
                />
                <Label htmlFor="course-published">Publish immediately</Label>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold">Modules</h3>
                  <p className="text-sm text-muted-foreground">Create text, video, slideshow, and quiz modules.</p>
                </div>
                <Button type="button" variant="outline" onClick={handleAddModule}>
                  <Plus size={16} className="mr-2" />
                  Add Module
                </Button>
              </div>

              {moduleFields.length === 0 && (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  Add your first module to start building the course.
                </div>
              )}

              {moduleFields.map((moduleField, index) => {
                const moduleItem = watchedModules[index] ?? moduleField
                const moduleTitleId = `module-${moduleField.id}-title`
                const moduleDurationId = `module-${moduleField.id}-duration`
                const moduleDescriptionId = `module-${moduleField.id}-description`
                const moduleContentTypeId = `module-${moduleField.id}-content-type`
                const moduleTextBodyId = `module-${moduleField.id}-text-body`
                const moduleVideoUrlId = `module-${moduleField.id}-video-url`
                const moduleVideoDurationId = `module-${moduleField.id}-video-duration`
                const moduleSlidesId = `module-${moduleField.id}-slides`
                const moduleQuestionPromptId = `module-${moduleField.id}-question-prompt`
                const moduleChoiceAId = `module-${moduleField.id}-choice-a`
                const moduleChoiceBId = `module-${moduleField.id}-choice-b`
                const moduleCorrectAnswerId = `module-${moduleField.id}-correct-answer`

                return (
                  <div key={moduleField.id} className="space-y-3 rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">Module {index + 1}</div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => handleMoveModule(index, -1)} disabled={index === 0}>Move Up</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => handleMoveModule(index, 1)} disabled={index === moduleFields.length - 1}>Move Down</Button>
                        <Button type="button" variant="destructive" size="sm" onClick={() => handleRemoveModule(index)}>Remove</Button>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={moduleTitleId}>Module Name</Label>
                        <Input
                          id={moduleTitleId}
                          {...register(`moduleDetails.${index}.title` as const)}
                          placeholder="e.g., Incident Response Overview"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={moduleDurationId}>Duration (minutes)</Label>
                        <Input
                          id={moduleDurationId}
                          type="number"
                          min="1"
                          step="1"
                          {...register(`moduleDetails.${index}.duration` as const, { valueAsNumber: true })}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor={moduleDescriptionId}>Module Details</Label>
                        <Textarea
                          id={moduleDescriptionId}
                          {...register(`moduleDetails.${index}.description` as const)}
                          placeholder="Describe the goal of this module"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor={moduleContentTypeId}>Content Type</Label>
                        <Select value={moduleItem.contentType} onValueChange={(value) => handleModuleContentTypeChange(index, value as Module['contentType'])}>
                          <SelectTrigger id={moduleContentTypeId} aria-label="Content Type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="video">Video</SelectItem>
                            <SelectItem value="slideshow">Slideshow</SelectItem>
                            <SelectItem value="quiz">Quiz</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {moduleItem.contentType === 'text' && (
                        (() => {
                          const textContent = moduleItem.content as Extract<Module['content'], { body: string }>

                          return (
                            <div className="space-y-2 md:col-span-2">
                              <Label htmlFor={moduleTextBodyId}>Body</Label>
                              <Textarea
                                id={moduleTextBodyId}
                                value={textContent.body}
                                onChange={(event) => handleModuleChange(index, { content: { body: event.target.value } })}
                                placeholder="Add text-based learning content"
                              />
                            </div>
                          )
                        })()
                      )}
                      {moduleItem.contentType === 'video' && (
                        (() => {
                          const videoContent = moduleItem.content as Extract<Module['content'], { url: string }>

                          return (
                            <>
                              <div className="space-y-2 md:col-span-2">
                                <Label htmlFor={moduleVideoUrlId}>Video URL</Label>
                                <Input
                                  id={moduleVideoUrlId}
                                  value={videoContent.url}
                                  onChange={(event) => handleModuleChange(index, { content: { ...videoContent, url: event.target.value } })}
                                  placeholder="https://example.com/video"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={moduleVideoDurationId}>Duration (seconds)</Label>
                                <Input
                                  id={moduleVideoDurationId}
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={videoContent.durationSeconds ?? ''}
                                  onChange={(event) => {
                                    const { value } = event.target
                                    handleModuleChange(index, {
                                      content: {
                                        ...videoContent,
                                        durationSeconds: value === '' ? undefined : Number(value),
                                      },
                                    })
                                  }}
                                />
                              </div>
                            </>
                          )
                        })()
                      )}
                      {moduleItem.contentType === 'slideshow' && (
                        (() => {
                          const slideshowContent = moduleItem.content as Extract<Module['content'], { slides: string[] }>

                          return (
                            <div className="space-y-2 md:col-span-2">
                              <Label htmlFor={moduleSlidesId}>Slides (one per line)</Label>
                              <Textarea
                                id={moduleSlidesId}
                                value={slideshowContent.slides.join('\n')}
                                onChange={(event) => handleModuleChange(index, { content: { slides: event.target.value.split('\n').map((value) => value.trim()).filter(Boolean) } })}
                                placeholder="Slide 1\nSlide 2"
                              />
                            </div>
                          )
                        })()
                      )}
                      {moduleItem.contentType === 'quiz' && (
                        (() => {
                          const quizContent = moduleItem.content as Extract<Module['content'], { questions: Array<{ prompt: string; choices: string[]; correctIndex: number }> }>
                          const firstQuestion = quizContent.questions[0] || { prompt: '', choices: ['', ''], correctIndex: 0 }

                          return (
                            <>
                              <div className="space-y-2 md:col-span-2">
                                <Label htmlFor={moduleQuestionPromptId}>Question Prompt</Label>
                                <Input
                                  id={moduleQuestionPromptId}
                                  value={firstQuestion.prompt}
                                  onChange={(event) => handleModuleChange(index, {
                                    content: {
                                      questions: [{
                                        prompt: event.target.value,
                                        choices: firstQuestion.choices,
                                        correctIndex: firstQuestion.correctIndex,
                                      }],
                                    },
                                  })}
                                  placeholder="What is the safest first step?"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={moduleChoiceAId}>Choice A</Label>
                                <Input
                                  id={moduleChoiceAId}
                                  value={firstQuestion.choices[0] || ''}
                                  onChange={(event) => handleModuleChange(index, {
                                    content: {
                                      questions: [{
                                        prompt: firstQuestion.prompt,
                                        choices: [event.target.value, firstQuestion.choices[1] || ''],
                                        correctIndex: firstQuestion.correctIndex,
                                      }],
                                    },
                                  })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={moduleChoiceBId}>Choice B</Label>
                                <Input
                                  id={moduleChoiceBId}
                                  value={firstQuestion.choices[1] || ''}
                                  onChange={(event) => handleModuleChange(index, {
                                    content: {
                                      questions: [{
                                        prompt: firstQuestion.prompt,
                                        choices: [firstQuestion.choices[0] || '', event.target.value],
                                        correctIndex: firstQuestion.correctIndex,
                                      }],
                                    },
                                  })}
                                />
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <Label htmlFor={moduleCorrectAnswerId}>Correct Answer</Label>
                                <Select
                                  value={String(firstQuestion.correctIndex)}
                                  onValueChange={(value) => handleModuleChange(index, {
                                    content: {
                                      questions: [{
                                        prompt: firstQuestion.prompt,
                                        choices: firstQuestion.choices,
                                        correctIndex: Number(value),
                                      }],
                                    },
                                  })}
                                >
                                  <SelectTrigger id={moduleCorrectAnswerId} aria-label="Correct Answer">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="0">Choice A</SelectItem>
                                    <SelectItem value="1">Choice B</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </>
                          )
                        })()
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCloseEditor} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveButtonClick} disabled={isSaving}>
              {isSaving ? 'Saving...' : editingCourse ? 'Save Changes' : 'Save Course'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
