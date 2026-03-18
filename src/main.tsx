/**
 * Application entry point.
 *
 * Mounts the React application into the `#root` DOM element, wrapped in an
 * {@link ErrorBoundary} that renders {@link ErrorFallback} when an unhandled
 * runtime error is thrown by any descendant component.
 */
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import "@github/spark/spark"

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <App />
   </ErrorBoundary>
)
