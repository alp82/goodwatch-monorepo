// Render synchronously so a first visit includes the full card HTML, including without JavaScript.
// The corresponding browser boundary can hydrate when its single design module arrives.
import { Suspense } from "react"
import { designByKey } from "./designs"
import { ScaledCard } from "./ScaledCard"
import type { SelectedCardProps } from "./selected-card"

export function SelectedCard({ designKey, ...props }: SelectedCardProps) {
	return (
		<Suspense fallback={null}>
			<ScaledCard {...props} design={designByKey(designKey)} />
		</Suspense>
	)
}
