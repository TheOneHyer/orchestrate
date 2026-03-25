import { useEffect, useMemo, useRef, useState } from 'react'
import { Clock, GraduationCap, MagnifyingGlass, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'

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

interface CourseEditorState {
  title: string
  description: string
  duration: string
  passScore: string
  certifications: string
  published: boolean
  moduleDetails: Module[]
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
  const [editorState, setEditorState] = useState<CourseEditorState>(initialEditorState)
  const [isSaving, setIsSaving] = useState(false)
  const processedPayloadRef = useRef<unknown>(null)

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
      setEditorState(initialEditorState)
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
  }, [courses, navigationPayload, onNavigationPayloadConsumed])

  const getEnrollmentForCourse = (courseId: string) => {
    return enrollments.find((enrollment) => enrollment.courseId === courseId && enrollment.userId === currentUser.id)
  }

  const canCreateCourse = currentUser.role === 'admin' || currentUser.role === 'trainer'
  const canManageCourse = (course: Course) => currentUser.role === 'admin' || course.createdBy === currentUser.id

  const handleOpenCourse = (course: Course) => {
    onNavigate('courses', { courseId: course.id })
  }

  const handleOpenEditor = (course?: Course) => {
    setEditingCourse(course || null)
    setEditorState(course ? createEditorStateFromCourse(course) : initialEditorState)
    setEditorDialogOpen(true)
  }

  const handleCloseEditor = () => {
    setEditorState(initialEditorState)
    setEditingCourse(null)
    setEditorDialogOpen(false)
  }

  const handleModuleChange = (index: number, updates: Partial<Module>) => {
    setEditorState((current) => ({
      ...current,
      moduleDetails: current.moduleDetails.map((moduleItem, moduleIndex) => (
        moduleIndex === index ? { ...moduleItem, ...updates } : moduleItem
      )),
    }))
  }

  const handleModuleContentTypeChange = (index: number, contentType: Module['contentType']) => {
    handleModuleChange(index, {
      contentType,
      content: createDefaultModuleContent(contentType),
    })
  }

  const handleAddModule = () => {
    setEditorState((current) => ({
      ...current,
      moduleDetails: [
        ...current.moduleDetails,
        {
          id: `module-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title: `Module ${current.moduleDetails.length + 1}`,
          description: '',
          contentType: 'text',
          content: createDefaultModuleContent('text'),
          duration: 15,
          order: current.moduleDetails.length,
        },
      ],
    }))
  }

  const handleMoveModule = (index: number, direction: -1 | 1) => {
    setEditorState((current) => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= current.moduleDetails.length) {
        return current
      }

      const reordered = [...current.moduleDetails]
      const [moduleItem] = reordered.splice(index, 1)
      reordered.splice(nextIndex, 0, moduleItem)

      return {
        ...current,
        moduleDetails: reordered.map((entry, order) => ({ ...entry, order })),
      }
    })
  }

  const handleRemoveModule = (index: number) => {
    setEditorState((current) => ({
      ...current,
      moduleDetails: current.moduleDetails
        .filter((_, moduleIndex) => moduleIndex !== index)
        .map((moduleItem, order) => ({ ...moduleItem, order })),
    }))
  }

  const buildCoursePayload = () => {
    const title = editorState.title.trim()
    const description = editorState.description.trim()
    const duration = Number(editorState.duration)
    const passScoreRaw = editorState.passScore.trim()
    const passScore = Number(passScoreRaw)
    const certifications = editorState.certifications.split(',').map((value) => value.trim()).filter(Boolean)
    const moduleDetails = editorState.moduleDetails.map((moduleItem, order) => ({
      ...moduleItem,
      title: moduleItem.title.trim(),
      description: moduleItem.description.trim(),
      duration: Number(moduleItem.duration),
      order,
    }))

    if (!title || !description) {
      throw new Error('Title and description are required.')
    }

    if (!Number.isInteger(duration) || duration <= 0) {
      throw new Error('Duration must be a positive whole number in minutes.')
    }

    if (!passScoreRaw) {
      throw new Error('Pass score must be between 0 and 100.')
    }

    if (!Number.isInteger(passScore) || passScore < 0 || passScore > 100) {
      throw new Error('Pass score must be between 0 and 100.')
    }

    if (moduleDetails.length === 0) {
      throw new Error('At least one module is required.')
    }

    if (moduleDetails.some((moduleItem) => !moduleItem.title || !Number.isInteger(moduleItem.duration) || moduleItem.duration <= 0)) {
      throw new Error('Each module needs a title and positive duration.')
    }

    return {
      title,
      description,
      duration,
      passScore,
      certifications,
      published: editorState.published,
      modules: summarizeModuleTitles(moduleDetails),
      moduleDetails,
    }
  }

  const handleSaveCourse = async () => {
    if (isSaving) {
      return
    }

    if (!canCreateCourse || (!onCreateCourse && !onUpdateCourse)) {
      toast.error('Course management unavailable', {
        description: 'You do not have permission to manage courses.',
      })
      return
    }

    let coursePayload: Omit<Course, 'id'> | Partial<Course>
    try {
      coursePayload = {
        ...buildCoursePayload(),
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
        if (!onUpdateCourse) {
          toast.error('Course update unavailable', {
            description: 'Update callback is not configured.',
          })
          return
        }
        await Promise.resolve(onUpdateCourse(editingCourse.id, coursePayload))
        setSelectedCourse((current) => current?.id === editingCourse.id ? { ...editingCourse, ...coursePayload } : current)
        toast.success('Course updated', {
          description: `${coursePayload.title} has been saved.`,
        })
      } else {
        if (!onCreateCourse) {
          toast.error('Course creation unavailable', {
            description: 'Create callback is not configured.',
          })
          return
        }
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
  }

  const handleDeleteSelectedCourse = async () => {
    if (!selectedCourse || !onDeleteCourse || !canManageCourse(selectedCourse)) {
      return
    }

    const confirmed = window.confirm(`Delete ${selectedCourse.title}? Related sessions will also be removed.`)
    if (!confirmed) {
      return
    }

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
    }
  }

  const handlePublishToggle = async () => {
    if (!selectedCourse || !onUpdateCourse || !canManageCourse(selectedCourse)) {
      return
    }

    const nextPublished = !selectedCourse.published

    try {
      await Promise.resolve(onUpdateCourse(selectedCourse.id, { published: nextPublished }))
      setSelectedCourse({ ...selectedCourse, published: nextPublished })
      toast.success(nextPublished ? 'Course published' : 'Course moved to draft', {
        description: `${selectedCourse.title} is now ${nextPublished ? 'available' : 'hidden from employees'} for scheduling.`,
      })
    } catch (error) {
      toast.error('Status update failed', {
        description: error instanceof Error && error.message
          ? error.message
          : 'Please try again after resolving the issue.',
      })
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
                    <Button variant={selectedCourse.published ? 'outline' : 'default'} onClick={handlePublishToggle}>
                      {selectedCourse.published ? 'Move to Draft' : 'Publish Course'}
                    </Button>
                  </div>
                  {onDeleteCourse && (
                    <Button variant="destructive" onClick={handleDeleteSelectedCourse}>
                      <Trash size={16} className="mr-2" />
                      Delete Course
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
                  value={editorState.title}
                  onChange={(event) => setEditorState((current) => ({ ...current, title: event.target.value }))}
                  placeholder="e.g., Workplace Safety Basics"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="course-description">Description</Label>
                <Textarea
                  id="course-description"
                  value={editorState.description}
                  onChange={(event) => setEditorState((current) => ({ ...current, description: event.target.value }))}
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
                  value={editorState.duration}
                  onChange={(event) => setEditorState((current) => ({ ...current, duration: event.target.value }))}
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
                  value={editorState.passScore}
                  onChange={(event) => setEditorState((current) => ({ ...current, passScore: event.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="course-certifications">Certifications (comma-separated)</Label>
                <Input
                  id="course-certifications"
                  value={editorState.certifications}
                  onChange={(event) => setEditorState((current) => ({ ...current, certifications: event.target.value }))}
                  placeholder="Safety 101, OSHA Intro"
                />
              </div>
              <div className="flex items-center gap-3 md:col-span-2">
                <Checkbox
                  id="course-published"
                  checked={editorState.published}
                  onCheckedChange={(checked) => setEditorState((current) => ({ ...current, published: checked === true }))}
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

              {editorState.moduleDetails.length === 0 && (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  Add your first module to start building the course.
                </div>
              )}

              {editorState.moduleDetails.map((moduleItem, index) => (
                <div key={moduleItem.id} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">Module {index + 1}</div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => handleMoveModule(index, -1)} disabled={index === 0}>Move Up</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => handleMoveModule(index, 1)} disabled={index === editorState.moduleDetails.length - 1}>Move Down</Button>
                      <Button type="button" variant="destructive" size="sm" onClick={() => handleRemoveModule(index)}>Remove</Button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Module Title</Label>
                      <Input
                        value={moduleItem.title}
                        onChange={(event) => handleModuleChange(index, { title: event.target.value })}
                        placeholder="e.g., Incident Response Overview"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Duration (minutes)</Label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={moduleItem.duration}
                        onChange={(event) => handleModuleChange(index, { duration: Number(event.target.value) })}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Description</Label>
                      <Textarea
                        value={moduleItem.description}
                        onChange={(event) => handleModuleChange(index, { description: event.target.value })}
                        placeholder="Describe the goal of this module"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Content Type</Label>
                      <Select value={moduleItem.contentType} onValueChange={(value) => handleModuleContentTypeChange(index, value as Module['contentType'])}>
                        <SelectTrigger>
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
                            <Label>Body</Label>
                            <Textarea
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
                              <Label>Video URL</Label>
                              <Input
                                value={videoContent.url}
                                onChange={(event) => handleModuleChange(index, { content: { ...videoContent, url: event.target.value } })}
                                placeholder="https://example.com/video"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Duration (seconds)</Label>
                              <Input
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
                            <Label>Slides (one per line)</Label>
                            <Textarea
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
                              <Label>Question Prompt</Label>
                              <Input
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
                              <Label>Choice A</Label>
                              <Input
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
                              <Label>Choice B</Label>
                              <Input
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
                              <Label>Correct Answer</Label>
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
                                <SelectTrigger>
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
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCloseEditor} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveCourse} disabled={isSaving}>
              {isSaving ? 'Saving...' : editingCourse ? 'Save Changes' : 'Save Course'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
