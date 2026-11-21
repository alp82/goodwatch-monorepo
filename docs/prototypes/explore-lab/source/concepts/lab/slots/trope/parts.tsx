// PROTOTYPE - throwaway (prototype/explore-r9). Trope page, variant "parts": the round 8 header and sidebar, with the
// three parts the owner wanted to steer separately ("we should have more prototype controls here") as lab parts of
// their own: the examples body (trope-body), how spoilers are held back (trope-spoiler), and the sections under the
// page (trope-below). Each part's variants are pills in the lab panel.
import { useMemo } from "react"
import { kindNoun } from "../../../../kit/address"
import type { SlotVariant } from "../../contract"
import { Part, useLab } from "../../lab"
import type { TropePageData } from "../tropes/model"
import { TropeFrame, type TropeProps, strongest } from "./frame"
import { SpoilerScope, SpoilerSwitch } from "./spoil"

function View({ data, address, to }: TropeProps) {
	const lab = useLab()
	const cases = useMemo(() => (data ? strongest(data.examples) : []), [data])
	const noun = kindNoun(address.kind)
	// The full decade row below replaces the header's small chart, so the page says it once.
	const chart = lab.pick("trope-below") !== "rows"
	return (
		<SpoilerScope>
			<TropeFrame
				data={data}
				address={address}
				to={to}
				chart={chart}
				body={(d: TropePageData) => (
					<Part
						slot="trope-body"
						d={d}
						cases={cases}
						noun={noun}
						tools={<SpoilerSwitch tint={d.trope.color} />}
					/>
				)}
				below={(d: TropePageData) => (
					<Part slot="trope-below" d={d} kind={address.kind} to={to} noun={noun} />
				)}
			/>
		</SpoilerScope>
	)
}

export const variant: SlotVariant<TropePageData | null> = {
	id: "parts",
	name: "Built from parts",
	what: "The header and sidebar you liked, with the examples, the spoilers and the sections below as separate lab parts (Examples, Spoilers, Below).",
	order: 1,
	View,
	notes: () => [
		{
			term: "Strongest",
			means:
				"Well-known titles first, and write-ups about the title itself before ones about a tie-in book, comic or cut scene.",
		},
		{
			term: "Twist tags",
			means:
				"Read from the first words of each write-up: Subverted, Inverted, Averted, Lampshaded, Exaggerated, Downplayed or Played With.",
		},
		{
			term: "Blend it",
			means:
				"Moods, genres, decades and countries the trope turns up in more than usual, each a real blend page with enough titles.",
			isNew: true,
		},
	],
}
