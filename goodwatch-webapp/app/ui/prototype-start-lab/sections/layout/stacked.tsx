// PROTOTYPE (start page lab): baseline layout: the blocks in order, the room as a band under the hero.
import type { ComponentType } from "react"
import { useLab } from "../../lab/types"

export function Stacked({
	Hero,
	Recs,
	How,
	Browse,
}: {
	Hero: ComponentType
	Recs: ComponentType
	How: ComponentType
	Browse: ComponentType
}) {
	const { Room } = useLab()
	return (
		<div className="pb-24">
			<Hero />
			<Room className="h-[56vh] min-h-[320px] w-full" />
			<Recs />
			<How />
			<Browse />
		</div>
	)
}
