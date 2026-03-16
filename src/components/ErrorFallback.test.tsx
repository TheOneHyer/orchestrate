import { render, screen, fireEvent } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { ErrorFallback } from '../ErrorFallback'

// Vitest runs with mode='test' (not 'production'), so import.meta.env.DEV defaults to true.
// Override it so ErrorFallback renders its fallback UI instead of rethrowing.
beforeAll(() => { vi.stubEnv('DEV', false) })
afterAll(() => { vi.unstubAllEnvs() })

describe('ErrorFallback', () => {
    it('displays the error message in the pre element', () => {
        const error = new Error('Something went terribly wrong')
        render(<ErrorFallback error={error} resetErrorBoundary={vi.fn()} />)

        const message = screen.getByText('Something went terribly wrong')
        expect(message).toBeInTheDocument()
        expect(message.tagName).toBe('PRE')
    })

    it('calls resetErrorBoundary when the Try Again button is clicked', () => {
        const error = new Error('Oops')
        const resetErrorBoundary = vi.fn()
        render(<ErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} />)

        fireEvent.click(screen.getByRole('button', { name: /try again/i }))

        expect(resetErrorBoundary).toHaveBeenCalledOnce()
    })

    it('renders the generic alert title and description', () => {
        render(<ErrorFallback error={new Error('x')} resetErrorBoundary={vi.fn()} />)

        expect(screen.getByText(/this spark has encountered a runtime error/i)).toBeInTheDocument()
        expect(screen.getByText(/contact the spark author/i)).toBeInTheDocument()
    })
})
