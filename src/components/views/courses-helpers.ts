import { Module } from '@/lib/types'

/**
 * Error payload used when a course save operation is blocked by missing access or callbacks.
 */
export interface CourseSavePermissionError {
    /** User-facing toast title. */
    title: string
    /** User-facing toast description. */
    description: string
}

/**
 * Resolves whether a course save action is allowed and, if not, returns the appropriate toast payload.
 *
 * @param options - Save permission inputs for create/edit mode.
 * @returns `null` when saving is allowed; otherwise an error title/description payload.
 */
export function getCourseSavePermissionError(options: {
    isEditing: boolean
    canManageEditingCourse: boolean
    hasUpdateCallback: boolean
    canCreateCourse: boolean
    hasCreateCallback: boolean
}): CourseSavePermissionError | null {
    if (options.isEditing) {
        if (!options.canManageEditingCourse) {
            return {
                title: 'Course management unavailable',
                description: 'You do not have permission to manage courses.',
            }
        }

        if (!options.hasUpdateCallback) {
            return {
                title: 'Course update unavailable',
                description: 'Update callback is not configured.',
            }
        }

        return null
    }

    if (!options.canCreateCourse) {
        return {
            title: 'Course management unavailable',
            description: 'You do not have permission to manage courses.',
        }
    }

    if (!options.hasCreateCallback) {
        return {
            title: 'Course creation unavailable',
            description: 'Create callback is not configured.',
        }
    }

    return null
}

/**
 * Determines whether the selected course can be deleted in the current state.
 *
 * @param options - Delete-guard inputs.
 * @returns True when delete should proceed.
 */
export function canDeleteSelectedCourse(options: {
    hasSelectedCourse: boolean
    hasDeleteCallback: boolean
    canManageSelectedCourse: boolean
    isDeleting: boolean
}): boolean {
    return options.hasSelectedCourse && options.hasDeleteCallback && options.canManageSelectedCourse && !options.isDeleting
}

/**
 * Determines whether publish/draft toggling is allowed for the selected course in the current state.
 *
 * @param options - Publish-guard inputs.
 * @returns True when publish/draft toggling should proceed.
 */
export function canPublishSelectedCourse(options: {
    hasSelectedCourse: boolean
    hasUpdateCallback: boolean
    canManageSelectedCourse: boolean
    isPublishing: boolean
}): boolean {
    return options.hasSelectedCourse && options.hasUpdateCallback && options.canManageSelectedCourse && !options.isPublishing
}

/**
 * Merges module updates when a current module exists.
 *
 * @param currentModule - Current module value from form state.
 * @param updates - Partial updates to apply.
 * @returns Updated module object, or null when no module exists at the target index.
 */
export function mergeModuleUpdates<T extends object>(currentModule: T | undefined, updates: Partial<T>): T | null {
    if (!currentModule) {
        return null
    }

    return { ...currentModule, ...updates }
}

/**
 * Determines whether a module can be moved in the requested direction.
 *
 * @param index - Current module index.
 * @param direction - Move direction (-1 for up, 1 for down).
 * @param moduleCount - Total number of modules.
 * @returns True when the move target stays within bounds.
 */
export function canMoveModule(index: number, direction: -1 | 1, moduleCount: number): boolean {
    const nextIndex = index + direction
    return nextIndex >= 0 && nextIndex < moduleCount
}

/**
 * Returns the first quiz question, providing an empty default when none exist.
 *
 * @param quizContent - Quiz content payload from a module.
 * @returns The first existing question or a safe default placeholder.
 */
export function getFirstQuizQuestion(quizContent: { questions: Array<{ prompt: string; choices: string[]; correctIndex: number }> }) {
    return quizContent.questions[0] || { prompt: '', choices: ['', ''], correctIndex: 0 }
}

/**
 * Validates whether a module has meaningful content for its type.
 *
 * @param moduleItem - Module entry to validate.
 * @returns True when content is sufficiently populated.
 */
export function validateModuleContentByType(moduleItem: Module): boolean {
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
