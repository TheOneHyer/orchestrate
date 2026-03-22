import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Plus, MagnifyingGlass, GraduationCap, Clock } from '@phosphor-icons/react'
import { Course, Enrollment, User } from '@/lib/types'
import { formatDuration } from '@/lib/helpers'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

const initialCreateForm = {
  title: '',
  description: '',
  duration: '60',
  passScore: '80',
  modules: '',
  certifications: '',
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
  onNavigate: (view: string, data?: any) => void
  /** Optional callback invoked when a new course is created from this view; may complete asynchronously. */
  onCreateCourse?: (course: Course) => void | Promise<void>
  /** Optional navigation payload used to open create/detail interactions. */
  navigationPayload?: unknown
  /** Optional callback invoked after a navigation payload has been consumed. */
  onNavigationPayloadConsumed?: () => void
}

/**
 * Type guard for courses view navigation payload.
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
 * Renders the Courses library view with search, filtering, and per-course enrollment progress.
 *
 * Displays a searchable grid of course cards showing title, description, duration, module
 * count, required certifications, and enrollment progress for the current user. Admins and
 * trainers additionally see a "Create Course" button.
 *
 * @param courses - All courses to display.
 * @param enrollments - Enrollment records used to render per-course progress.
 * @param currentUser - The authenticated user; role determines visible actions.
 * @param onNavigate - Navigation callback invoked on card click or create-course action.
 * @param onCreateCourse - Optional course creation callback; if it returns a promise, the dialog remains open until the save completes.
 * @param navigationPayload - Optional one-time payload used to open create or detail dialogs from app-level navigation.
 * @returns The rendered Courses page element.
 */
export function Courses({ courses, enrollments, currentUser, onNavigate, onCreateCourse, navigationPayload, onNavigationPayloadConsumed }: CoursesProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const processedPayloadRef = useRef<unknown>(null)
  const [createForm, setCreateForm] = useState(initialCreateForm)

  const filteredCourses = courses.filter(course =>
    course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  useEffect(() => {
    if (processedPayloadRef.current === navigationPayload) {
      return
    }

    if (!isCoursesNavigationPayload(navigationPayload)) {
      processedPayloadRef.current = navigationPayload
      return
    }

    if (navigationPayload.create) {
      setCreateDialogOpen(true)
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
  }, [navigationPayload, onNavigationPayloadConsumed, courses])

  /**
   * Finds the current user's enrollment record for a specific course.
   * @param courseId - The ID of the course to look up.
   * @returns The matching `Enrollment` for the current user, or `undefined` if not enrolled.
   */
  const getEnrollmentForCourse = (courseId: string) => {
    return enrollments.find(e => e.courseId === courseId && e.userId === currentUser.id)
  }

  const canCreateCourse = currentUser.role === 'admin' || currentUser.role === 'trainer'

  const handleOpenCourse = (course: Course) => {
    onNavigate('courses', { courseId: course.id })
  }

  const handleCreateCourseClick = () => {
    onNavigate('courses', { create: true })
  }

  const handleCloseCreateDialog = () => {
    setCreateForm(initialCreateForm)
    setCreateDialogOpen(false)
  }

  const handleSaveCourse = async () => {
    if (isSaving) {
      return
    }

    if (!canCreateCourse || !onCreateCourse) {
      toast.error('Course creation unavailable', {
        description: 'You do not have permission to create courses.',
      })
      return
    }

    const title = createForm.title.trim()
    const description = createForm.description.trim()
    const duration = Number(createForm.duration)
    const passScore = Number(createForm.passScore)
    const modules = createForm.modules.split(',').map((value) => value.trim()).filter(Boolean)
    const certifications = createForm.certifications.split(',').map((value) => value.trim()).filter(Boolean)

    if (!title || !description) {
      toast.error('Missing required fields', {
        description: 'Title and description are required.',
      })
      return
    }

    if (!Number.isInteger(duration) || duration <= 0) {
      toast.error('Invalid duration', {
        description: 'Duration must be a positive whole number in minutes.',
      })
      return
    }

    if (!Number.isInteger(passScore) || passScore < 0 || passScore > 100) {
      toast.error('Invalid pass score', {
        description: 'Pass score must be between 0 and 100.',
      })
      return
    }

    const createCourseId = () => {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
      }

      // Fallback for environments without crypto.randomUUID support.
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
        const randomValue = Math.floor(Math.random() * 16)
        const value = char === 'x' ? randomValue : ((randomValue & 0x3) | 0x8)
        return value.toString(16)
      })
    }

    const newCourse: Course = {
      id: createCourseId(),
      title,
      description,
      duration,
      passScore,
      modules,
      certifications,
      createdBy: currentUser.id,
      createdAt: new Date().toISOString(),
      published: false,
    }

    setIsSaving(true)

    try {
      await Promise.resolve(onCreateCourse(newCourse))
      handleCloseCreateDialog()

      toast.success('Course created', {
        description: `${title} has been added as a draft course.`,
      })
    } catch (error) {
      const description = error instanceof Error && error.message
        ? error.message
        : 'Please try again after resolving the issue.'

      toast.error('Course creation failed', {
        description,
      })
    } finally {
      setIsSaving(false)
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
          <Button onClick={handleCreateCourseClick}>
            <Plus size={18} weight="bold" className="mr-2" />
            Create Course
          </Button>
        )}
      </div>

      <div className="relative">
        <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search courses..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCourses.map(course => {
          const enrollment = getEnrollmentForCourse(course.id)

          return (
            <Card
              key={course.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              role="button"
              tabIndex={0}
              aria-label={`Open course ${course.title}`}
              onClick={() => handleOpenCourse(course)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleOpenCourse(course)
                }
              }}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <GraduationCap size={24} />
                    </AvatarFallback>
                  </Avatar>
                  {!course.published && (
                    <Badge variant="outline">Draft</Badge>
                  )}
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
                    {course.modules.length} module{course.modules.length === 1 ? '' : 's'}
                  </span>
                </div>

                {course.certifications.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {course.certifications.slice(0, 2).map(cert => (
                      <Badge key={cert} variant="secondary" className="text-xs">
                        {cert}
                      </Badge>
                    ))}
                    {course.certifications.length > 2 && (
                      <Badge variant="secondary" className="text-xs">
                        +{course.certifications.length - 2}
                      </Badge>
                    )}
                  </div>
                )}

                {enrollment && (
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
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
          <GraduationCap size={64} className="mx-auto text-muted-foreground opacity-50 mb-4" />
          <p className="text-muted-foreground">No courses found</p>
        </div>
      )}

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedCourse?.title || 'Course details'}</DialogTitle>
            <DialogDescription>{selectedCourse?.description}</DialogDescription>
          </DialogHeader>
          {selectedCourse && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
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
                  <div className="font-medium">{selectedCourse.modules.length}</div>
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
                    {selectedCourse.certifications.map((cert) => (
                      <Badge key={cert} variant="secondary">{cert}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="text-sm font-medium">Modules</div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {selectedCourse.modules.length === 0 ? (
                    <div>No modules defined.</div>
                  ) : (
                    selectedCourse.modules.map((moduleName, index) => (
                      <div key={`${moduleName}-${index}`}>{index + 1}. {moduleName}</div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setCreateDialogOpen(true)
            return
          }

          if (isSaving) {
            setCreateDialogOpen(true)
            return
          }

          handleCloseCreateDialog()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Course</DialogTitle>
            <DialogDescription>Add a new draft course to the catalog.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="course-title">Title</Label>
              <Input
                id="course-title"
                value={createForm.title}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="e.g., Workplace Safety Basics"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="course-description">Description</Label>
              <Input
                id="course-description"
                value={createForm.description}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Briefly describe this course"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="course-duration">Duration (minutes)</Label>
                <Input
                  id="course-duration"
                  type="number"
                  min="1"
                  step="1"
                  value={createForm.duration}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, duration: event.target.value }))}
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
                  value={createForm.passScore}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, passScore: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="course-modules">Modules (comma-separated)</Label>
              <Input
                id="course-modules"
                value={createForm.modules}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, modules: event.target.value }))}
                placeholder="Intro, Hands-on Exercise, Final Quiz"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="course-certifications">Certifications (comma-separated)</Label>
              <Input
                id="course-certifications"
                value={createForm.certifications}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, certifications: event.target.value }))}
                placeholder="Safety 101, OSHA Intro"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCloseCreateDialog} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveCourse} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Course'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
