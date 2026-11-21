// PROTOTYPE - throwaway (prototype/explore-r5). The round 4 pick for this page, unchanged: the baseline to beat.
import type { RoomsData } from "../../../rooms/loader.server"
import { RoomsView, roomsNotes } from "../../baselines"
import type { SlotVariant } from "../../contract"

export const variant: SlotVariant<RoomsData> = {
	id: "r4",
	name: "Round 4: Rooms",
	what: "The Rooms service page: the whole library, strong and thin spots in a sentence.",
	View: RoomsView,
	notes: roomsNotes,
}
