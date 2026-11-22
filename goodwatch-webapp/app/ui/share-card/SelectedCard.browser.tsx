// Hydrate the card that the server has already drawn. The picker mounts all previews only when opened.
import { lazy, Suspense } from "react"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import type { CardDesign } from "./model"
import { ScaledCard } from "./ScaledCard"
import type { SelectedCardProps } from "./selected-card"

const modules = import.meta.glob<Record<string, CardDesign>>("./designs/*.tsx")
const templates = new Map(
	Object.entries(modules).map(([path, load]) => {
		const key = path.slice("./designs/".length, -".tsx".length)
		const Template = lazy(
			reloadOnStaleChunk(async () => {
				const design = (await load())[key]
				return {
					default: (props: Omit<SelectedCardProps, "designKey">) => (
						<ScaledCard {...props} design={design} />
					),
				}
			}),
		)
		return [key, Template] as const
	}),
)

export function SelectedCard({ designKey, ...props }: SelectedCardProps) {
	const Template = templates.get(designKey) ?? templates.get("podium")!
	return (
		<Suspense fallback={null}>
			<Template {...props} />
		</Suspense>
	)
}
