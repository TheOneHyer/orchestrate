import type { ComponentPropsWithoutRef } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { User } from '@/lib/types'

/**
 * Props for the {@link DeletePersonDialog} component.
 */
interface DeletePersonDialogProps {
  /** The user to be deleted, or `null` when no user has been selected. */
  user: User | null
  /** Whether the confirmation dialog is open. */
  open: boolean
  /** Callback to update the open state of the dialog. */
  onOpenChange: (open: boolean) => void
  /** Callback invoked when the user clicks the destructive "Delete" action. */
  onConfirm: () => void
}

/**
 * Confirmation dialog shown before permanently deleting a user.
 *
 * Renders an accessible {@link AlertDialog} that displays the user's name and a
 * role-specific warning (trainers are removed from sessions, employees from enrolled
 * courses). Returns `null` when `user` is `null`. The delete action is only executed
 * when the user explicitly clicks "Delete".
 */
export function DeletePersonDialog({ user, open, onOpenChange, onConfirm }: DeletePersonDialogProps) {
  if (!user) return null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent overlayProps={{ 'data-testid': 'dialog-overlay' } as ComponentPropsWithoutRef<'div'>}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {user.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete <strong>{user.name}</strong>'s profile
            {user.role === 'trainer' && ' and remove them from all assigned training sessions'}.
            {user.role === 'employee' && ' and remove them from all enrolled courses'}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
