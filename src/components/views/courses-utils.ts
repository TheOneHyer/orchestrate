/** Describes a single field-level validation error message. */
interface ValidationMessageField {
    message?: unknown
}

/** Describes the supported nested module validation fields. */
interface CourseModuleValidationError {
    title?: ValidationMessageField
    duration?: ValidationMessageField
}

/** Describes the subset of course editor validation errors consumed by the UI toast helper. */
interface CourseValidationErrorShape {
    title?: ValidationMessageField
    description?: ValidationMessageField
    duration?: ValidationMessageField
    passScore?: ValidationMessageField
    moduleDetails?: ValidationMessageField | CourseModuleValidationError[]
}

/**
 * Returns the first human-readable course editor validation message.
 *
 * @param errors - Validation errors produced by the course editor form.
 * @returns The first matching message, or a generic fallback when none are found.
 */
export function getFirstValidationErrorMessage(errors: CourseValidationErrorShape): string {
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

    if (!Array.isArray(errors.moduleDetails) && typeof errors.moduleDetails?.message === 'string') {
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
