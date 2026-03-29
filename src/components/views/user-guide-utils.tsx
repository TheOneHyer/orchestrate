import type { ComponentType, ReactNode } from 'react'
import { BookOpen } from '@phosphor-icons/react'
import type { IconProps } from '@phosphor-icons/react'

/** Describes a single section entry in the User Guide sidebar. */
export interface Section {
    /** Unique identifier used to track the active section. */
    id: string
    /** Human-readable label shown in the sidebar navigation. */
    label: string
    /** Phosphor icon component rendered next to the label. */
    icon: ComponentType<IconProps>
    /** User roles that this section is relevant to (e.g. `['admin', 'trainer']`). */
    roles: string[]
    /** JSX content rendered in the main panel when this section is active. */
    content: ReactNode
}

/**
 * Returns the section whose `id` matches `key`, or a fallback section when none is found.
 *
 * @param availableSections - Ordered list of sections to search.
 * @param key - Optional section ID to resolve.
 * @returns The matched section; if `key` is not found, the first section in `availableSections`; if `availableSections` is empty, a placeholder section.
 */
export function getSectionOrFallback(availableSections: Section[], key?: string): Section {
    if (availableSections.length === 0) {
        return {
            id: '',
            label: 'No Sections Available',
            icon: BookOpen,
            roles: [],
            content: '',
        }
    }
    return availableSections.find((section) => section.id === key) ?? availableSections[0]
}
