/**
 * Provides typed React component defaults for Lucide deep icon imports such as
 * "lucide-react/dist/esm/icons/alarm-clock".
 */
declare module "lucide-react/dist/esm/icons/*" {
    import type { LucideIcon } from "lucide-react"

    /**
     * Default icon component export for a Lucide deep import path.
     * @type {LucideIcon}
     */
    const Icon: LucideIcon
    export default Icon
}
