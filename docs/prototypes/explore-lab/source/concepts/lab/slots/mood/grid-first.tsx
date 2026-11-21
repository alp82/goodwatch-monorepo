// PROTOTYPE - throwaway (prototype/explore-r6, slot "mood"). "Grid first": the list is the page. The head is one band
// that unfolds into the room; under it one screen-tall block holds the steering beside the grid, both the same height;
// the room's sections continue under it.
import { LayoutGroup } from "framer-motion"
import { useState } from "react"
import { WRAP } from "../../../../kit/ui"
import type { SlotVariant } from "../../contract"
import { Body } from "./body"
import { MoodHead } from "./head"
import { moodNotes } from "./notes"
import type { MoodPageData } from "./page.server"
import { RoomSections } from "./room"
import type { HeadState, Props } from "./shared"
import { Stage } from "./stage"

function View({ data, address, to, viewer }: Props) {
	const [head, setHead] = useState<HeadState>("folded")
	return (
		<LayoutGroup>
			<MoodHead data={data} address={address} to={to} state={head} onState={setHead} />
			<Body>
				<div className={`${WRAP} space-y-14 pt-1`}>
					<Stage data={data} address={address} to={to} viewer={viewer} />
					<RoomSections data={data} address={address} to={to} />
				</div>
			</Body>
		</LayoutGroup>
	)
}

export const variant: SlotVariant<MoodPageData> = {
	id: "grid-first",
	name: "Grid first",
	what: "The list is the page: a band for a head that unfolds into the room, then one screen-tall block with the steering beside a grid that fills it exactly (Prev and Next), the room's sections under it.",
	order: 1,
	View,
	notes: moodNotes("grid-first"),
}
