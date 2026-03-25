import { describe, expect, it } from 'vitest'
import { createDefaultModuleContent, normalizeCourseModules, summarizeModuleTitles, withStructuredModules } from './course-modules'
import type { Course, Module } from './types'

function createCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: 'course-1',
    title: 'Course',
    description: 'Description',
    modules: ['Intro'],
    duration: 60,
    certifications: [],
    createdBy: 'trainer-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    published: false,
    passScore: 80,
    ...overrides,
  }
}

describe('course-modules', () => {
  it('creates default module content per content type', () => {
    expect(createDefaultModuleContent('video')).toEqual({ url: '' })
    expect(createDefaultModuleContent('slideshow')).toEqual({ slides: [''] })
    expect(createDefaultModuleContent('text')).toEqual({ body: '' })
    expect(createDefaultModuleContent('quiz')).toEqual({
      questions: [{ prompt: '', choices: ['', ''], correctIndex: 0 }],
    })
  })

  it('throws for unsupported module content types', () => {
    expect(() => createDefaultModuleContent('unsupported' as Module['contentType'])).toThrow(/unsupported module content type/i)
  })

  it('normalizes legacy string modules into structured modules', () => {
    const course = createCourse({ modules: ['Intro', 'Quiz'] })

    expect(normalizeCourseModules(course)).toEqual([
      {
        id: 'legacy-module-course-1-0',
        title: 'Intro',
        description: '',
        contentType: 'text',
        content: { body: '' },
        duration: 15,
        order: 0,
      },
      {
        id: 'legacy-module-course-1-1',
        title: 'Quiz',
        description: '',
        contentType: 'text',
        content: { body: '' },
        duration: 15,
        order: 1,
      },
    ])
  })

  it('prefers structured module details when present', () => {
    const moduleDetails: Module[] = [
      {
        id: 'module-2',
        title: 'Second',
        description: 'Second module',
        contentType: 'text',
        content: { body: 'Two' },
        duration: 10,
        order: 1,
      },
      {
        id: 'module-1',
        title: 'First',
        description: 'First module',
        contentType: 'video',
        content: { url: 'https://example.com' },
        duration: 20,
        order: 0,
      },
    ]

    expect(normalizeCourseModules(createCourse({ moduleDetails }))).toEqual([
      moduleDetails[1],
      { ...moduleDetails[0], order: 1 },
    ])
  })

  it('summarizes ordered module titles and filters blank entries', () => {
    const modules: Module[] = [
      {
        id: 'module-2',
        title: '  Summary  ',
        description: '',
        contentType: 'text',
        content: { body: '' },
        duration: 5,
        order: 1,
      },
      {
        id: 'module-1',
        title: 'Intro',
        description: '',
        contentType: 'text',
        content: { body: '' },
        duration: 5,
        order: 0,
      },
      {
        id: 'module-3',
        title: '   ',
        description: '',
        contentType: 'text',
        content: { body: '' },
        duration: 5,
        order: 2,
      },
    ]

    expect(summarizeModuleTitles(modules)).toEqual(['Intro', 'Summary'])
  })

  it('writes synchronized modules back to a course', () => {
    const course = createCourse({ modules: ['Legacy'] })
    const modules: Module[] = [
      {
        id: 'module-2',
        title: 'Wrap-up',
        description: '',
        contentType: 'text',
        content: { body: '' },
        duration: 5,
        order: 1,
      },
      {
        id: 'module-1',
        title: 'Intro',
        description: '',
        contentType: 'text',
        content: { body: '' },
        duration: 10,
        order: 0,
      },
    ]

    expect(withStructuredModules(course, modules)).toEqual({
      ...course,
      modules: ['Intro', 'Wrap-up'],
      moduleDetails: [
        { ...modules[1], order: 0 },
        { ...modules[0], order: 1 },
      ],
    })
  })
})
