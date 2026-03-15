import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Plus, MagnifyingGlass, GraduationCap, Clock } from '@phosphor-icons/react'
import { Course, Enrollment, User } from '@/lib/types'
import { formatDuration } from '@/lib/helpers'
import { useState } from 'react'

interface CoursesProps {
  courses: Course[]
  enrollments: Enrollment[]
  currentUser: User
  onNavigate: (view: string, data?: any) => void
}

export function Courses({ courses, enrollments, currentUser, onNavigate }: CoursesProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredCourses = courses.filter(course =>
    course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getEnrollmentForCourse = (courseId: string) => {
    return enrollments.find(e => e.courseId === courseId && e.userId === currentUser.id)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Courses</h1>
          <p className="text-muted-foreground mt-1">Browse and manage training courses</p>
        </div>
        {(currentUser.role === 'admin' || currentUser.role === 'trainer') && (
          <Button onClick={() => onNavigate('courses', { create: true })}>
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
            <Card key={course.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onNavigate('courses', { courseId: course.id })}>
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
                    {course.modules.length} modules
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
    </div>
  )
}
