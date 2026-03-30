import type { UserRole } from '@/lib/types'

/**
 * Runtime environment overrides used by App tests.
 */
export interface AppRuntimeEnvOverrides {
    /** Optional initial view used to bootstrap navigation state. */
    initialActiveView?: string
    /** Enables preview-mode behavior when true. */
    previewMode?: boolean
    /** Enables server-auth flow when true. */
    useServerAuth?: boolean
}

/**
 * Test hook callbacks exposed by App during Vitest runs.
 */
export interface AppTestHooks {
    /** Creates the first admin account in preview mode. */
    createFirstAdmin?: (values: { name: string; email: string; password: string }) => void
    /** Attempts local/server sign-in using form-like credentials. */
    handleSignIn?: (values: { email: string; password: string }) => Promise<void>
    /** Reassigns a role for a given user. */
    handleAssignRole?: (userId: string, role: UserRole) => Promise<void>
    /** Deletes a user and cascades related records. */
    handleDeleteUser?: (userId: string) => Promise<void>
    /** Marks a notification record as read. */
    handleMarkNotificationAsRead?: (id: string) => Promise<void>
}
