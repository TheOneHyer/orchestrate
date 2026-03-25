import { Course, Module, QuizContent, SlideshowContent, TextContent, VideoContent } from './types'

/**
 * Creates a default typed content payload for a given module content type.
 *
 * @param contentType - The content type to initialize.
 * @returns The default content payload for that content type.
 */
export function createDefaultModuleContent(contentType: Module['contentType']): VideoContent | SlideshowContent | QuizContent | TextContent {
  switch (contentType) {
    case 'video':
      return { url: '' }
    case 'slideshow':
      return { slides: [''] }
    case 'quiz':
      return {
        questions: [
          {
            prompt: '',
            choices: ['', ''],
            correctIndex: 0,
          },
        ],
      }
    case 'text':
      return { body: '' }
    default:
      throw new Error(`Unsupported module content type: ${String(contentType)}`)
  }
}

/**
 * Returns a normalized structured module list for a course.
 *
 * When a course only has legacy `modules` string values, this function synthesizes
 * structured module records so the visual editor can work without a storage migration.
 *
 * @param course - The course whose modules should be normalized.
 * @returns A stable array of structured modules.
 */
export function normalizeCourseModules(course: Course): Module[] {
  if (course.moduleDetails && course.moduleDetails.length > 0) {
    return [...course.moduleDetails]
      .sort((left, right) => left.order - right.order)
      .map((moduleItem, index) => ({ ...moduleItem, order: index }))
  }

  return course.modules.map((moduleTitle, index) => ({
    id: `legacy-module-${course.id}-${index}`,
    title: moduleTitle,
    description: '',
    contentType: 'text',
    content: { body: '' },
    duration: 15,
    order: index,
  }))
}

/**
 * Creates the legacy module title list stored on a course from structured modules.
 *
 * @param modules - The structured modules to summarize.
 * @returns The ordered list of module titles.
 */
export function summarizeModuleTitles(modules: Module[]): string[] {
  return [...modules]
    .sort((left, right) => left.order - right.order)
    .map((moduleItem) => moduleItem.title.trim())
    .filter((title) => title.length > 0)
}

/**
 * Rebuilds a course object with synchronized `modules` and `moduleDetails` fields.
 *
 * @param course - The course to update.
 * @param modules - The structured modules to persist.
 * @returns The updated course with normalized module ordering.
 */
export function withStructuredModules(course: Course, modules: Module[]): Course {
  const normalizedModules = [...modules]
    .sort((left, right) => left.order - right.order)
    .map((moduleItem, index) => ({ ...moduleItem, order: index }))

  return {
    ...course,
    modules: summarizeModuleTitles(normalizedModules),
    moduleDetails: normalizedModules,
  }
}
