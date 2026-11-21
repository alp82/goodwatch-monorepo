// Mood card "Faint still + type": see mixcard.tsx.
import type { BrowseViewProps } from "~/ui/browse/view"
import { LatticePage, type MoodCardProps } from "~/ui/browse/moods/lattice"
import { MixCard } from "~/ui/browse/moods/MoodCard"
import type { MoodsData } from "~/server/browse/moods.server"

const Card = (props: MoodCardProps) => <MixCard {...props} backdrop="faint" />

export function MoodsPage({ data }: BrowseViewProps<MoodsData>) {
	return <LatticePage data={data} Card={Card} gap="gap-2.5 sm:gap-3" />
}
