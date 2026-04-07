import { useEffect, useState } from "react"

/** Viewport width (in pixels) below which the layout is considered mobile. */
const MOBILE_BREAKPOINT = 768

/**
 * Hook that returns whether the current viewport width is below the mobile breakpoint (768 px).
 *
 * State is initialized synchronously from `window.innerWidth` on first render so that the
 * correct layout is selected immediately without a flash of the wrong layout. A
 * `window.matchMedia` change listener keeps the value reactive whenever the user resizes.
 *
 * @returns `true` when the viewport is narrower than {@link MOBILE_BREAKPOINT}, `false` otherwise.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
  )

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}