// PROTOTYPE - throwaway (prototype/explore-r9). Mood card "Faint still + type": see mixcard.tsx.
import type { PageViewProps, SlotVariant } from "../../contract"
import { LATTICE_NOTES, LatticePage, type MoodCardProps } from "./core"
import { MIX_NOTE, MixCard } from "./mixcard"
import type { MoodsData } from "./shared.server"

const Card = (props: MoodCardProps) => <MixCard {...props} backdrop="faint" />

function View({ data }: PageViewProps<MoodsData>) {
	return <LatticePage data={data} Card={Card} gap="gap-2.5 sm:gap-3" />
}

export const variant: SlotVariant<MoodsData> = {
	id: "still-faint",
	name: "Faint still + type",
	what: "The same card with the still barely there: mostly the mood's color and the large name, the film only a texture.",
	order: 6,
	View,
	notes: () => [...LATTICE_NOTES, MIX_NOTE],
}
