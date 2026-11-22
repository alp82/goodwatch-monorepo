import type { ComponentProps } from "react"
import type { ScaledCard } from "./ScaledCard"

export type SelectedCardProps = Omit<ComponentProps<typeof ScaledCard>, "design"> & {
	designKey: string
}
