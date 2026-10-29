// PROTOTYPE (Discover lab, mood j): one view. i's AND columns under one short row of e's mix cards: ready mixes while
// nothing is picked, then the choices that narrow the most ("+ Talky"), then "Without X" when few are left.
import type { SectionProps } from "../../types"
import { AndColumns, MixCards, RecipeRow, useAnd, useCards } from "./andview"
import { useWorldArt } from "./parts"

export function MoodJ({ d, phone, find, viewer }: SectionProps) {
	const a = useAnd(d)
	const art = useWorldArt()
	const cards = useCards(d, a, viewer, phone ? 4 : 6)
	const row = !find?.results && (
		<MixCards d={d} cards={cards} art={art} cols={phone ? "grid-cols-2" : "grid-cols-6"} tile="h-[3.75rem]" small />
	)
	if (phone)
		return (
			<div className="flex flex-col gap-4">
				<RecipeRow d={d} a={a} find={find} phone />
				{row}
				<AndColumns a={a} find={find} phone />
			</div>
		)
	return (
		<div className="flex h-full min-h-0 flex-col gap-3 px-6 py-3">
			<RecipeRow d={d} a={a} find={find} phone={false} />
			{row}
			<AndColumns a={a} find={find} phone={false} />
		</div>
	)
}
