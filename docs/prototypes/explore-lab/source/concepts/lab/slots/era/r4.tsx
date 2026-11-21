// PROTOTYPE - throwaway (prototype/explore-r5). The round 4 pick for this page, unchanged: the baseline to beat.
import type { RoomsData } from "../../../rooms/loader.server"
import { RoomsView, roomsNotes } from "../../baselines"
import type { SlotVariant } from "../../contract"

export const variant: SlotVariant<RoomsData> = {
	id: "r4",
	name: "Round 4: Rooms",
	what: "The Rooms decade page: what rose and fell against the decade before, and each year's standouts.",
	View: RoomsView,
	notes: roomsNotes,
}
