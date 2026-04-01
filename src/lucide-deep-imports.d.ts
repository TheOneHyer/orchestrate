/**
 * Provides typed React component defaults for Lucide deep icon imports such as
 * "lucide-react/dist/esm/icons/alarm-clock".
 */
declare module "lucide-react/dist/esm/icons/*" {
    import type { ComponentType } from "react"

    /**
     * Default icon component export for a Lucide deep import path.
     * @type {ComponentType<Record<string, unknown>>}
     */
    const Icon: ComponentType<Record<string, unknown>>
    export default Icon
}
