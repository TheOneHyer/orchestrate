import { useEffect, useState } from "react"

/** Viewport width (in pixels) below which the layout is considered mobile. */
const MOBILE_BREAKPOINT = 768

/**
 * Hook that returns whether the current viewport width is below the mobile breakpoint (768 px).
 *
 * Listens to `window.matchMedia` change events so the value updates reactively
 * whenever the user resizes the browser window.
 *
 * @returns `true` when the viewport is narrower than {@link MOBILE_BREAKPOINT}, `false` otherwise.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
