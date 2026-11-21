// PROTOTYPE - throwaway (prototype/explore-r6). Sub-slot of the mood page (and the genre, theme and style pages that
// share it): how the steering beside the grid looks and opens. The owner: "a longer list of rows that are clearly
// inactive and clicking on them reveals some cool control - like the slider (but also other things) - to steer the
// results." Its variants draw slots/mood/steer.tsx's model: `<Part slot="mood-steer" model={model} />`.
import type { SlotMeta } from "../../contract"
import { pageSlotOf } from "../../pages"

export const slot: SlotMeta = {
	id: "mood-steer",
	label: "Steering",
	order: 20,
	group: "part",
	applies: (address) =>
		address.view === "place" &&
		(["mood", "genre"].includes(pageSlotOf(address)) ||
			(pageSlotOf(address) === "other" &&
				(address.parts[0]?.family === "theme" || address.parts[0]?.family === "style"))),
	fallback: "rows",
}
