import { Alert, AlertTitle, AlertDescription } from "./components/ui/alert";
import { Button } from "./components/ui/button";
import type { FallbackProps } from "react-error-boundary";

import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";

/**
 * Fallback UI rendered by the top-level React {@link ErrorBoundary} when an
 * unhandled runtime error is thrown by any descendant component.
 *
 * In development mode the error is re-thrown immediately so that framework
 * overlay tooling (e.g., Vite's error overlay) can display a richer
 * diagnostic. In production, a user-facing alert is shown along with the
 * error message and a "Try Again" button that resets the boundary.
 *
 * @param props - Props injected by `react-error-boundary`.
 * @param props.error - The error object that was caught by the boundary.
 * @param props.resetErrorBoundary - Callback that resets the error boundary
 *   state, allowing the application to attempt re-rendering.
 * @returns A full-screen error card, or re-throws in development.
 */
export const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
  // When encountering an error in the development mode, rethrow it and don't display the boundary.
  // The parent UI will take care of showing a more helpful dialog.
  if (import.meta.env.DEV) throw error;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Alert variant="destructive" className="mb-6">
          <AlertTriangleIcon />
          <AlertTitle>This spark has encountered a runtime error</AlertTitle>
          <AlertDescription>
            Something unexpected happened while running the application. The error details are shown below. Contact the spark author and let them know about this issue.
          </AlertDescription>
        </Alert>
        
        <div className="bg-card border rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-sm text-muted-foreground mb-2">Error Details:</h3>
          <pre className="text-xs text-destructive bg-muted/50 p-3 rounded border overflow-auto max-h-32">
            {error instanceof Error ? error.message : String(error)}
          </pre>
        </div>
        
        <Button 
          onClick={resetErrorBoundary} 
          className="w-full"
          variant="outline"
        >
          <RefreshCwIcon />
          Try Again
        </Button>
      </div>
    </div>
  );
}
