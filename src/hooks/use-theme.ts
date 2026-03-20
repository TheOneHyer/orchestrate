import { useEffect } from 'react'
import { useKV } from '@github/spark/hooks'

/** The available application colour themes. */
export type Theme = 'light' | 'dark'

/**
 * Hook that manages the application colour theme.
 *
 * The active theme is persisted via KV storage and applied to the document root
 * element as a CSS class (`'light'` or `'dark'`), enabling Tailwind dark-mode
 * class-based switching.
 *
 * @returns An object containing:
 *   - `theme` – The currently active {@link Theme} (defaults to `'light'`).
 *   - `setTheme` – Directly set the theme to a specific value.
 *   - `toggleTheme` – Switch between `'light'` and `'dark'`.
 */
export function useTheme() {
  const [theme, setTheme] = useKV<Theme>('app-theme', 'light')

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme || 'light')
  }, [theme])

  const toggleTheme = () => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'))
  }

  return { theme: theme || 'light', setTheme, toggleTheme }
}
