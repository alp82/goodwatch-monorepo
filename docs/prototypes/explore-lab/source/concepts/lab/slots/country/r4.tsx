// PROTOTYPE - throwaway (prototype/explore-r5). The round 4 pick for this page, unchanged: the baseline to beat.
import type { RoomsData } from "../../../rooms/loader.server"
import { RoomsView, roomsNotes } from "../../baselines"
import type { SlotVariant } from "../../contract"

export const variant: SlotVariant<RoomsData> = {
	id: "r4",
	name: "Round 4: Rooms",
	what: "The Rooms country page: the zoomed map in the head and the hand-written description.",
	View: RoomsView,
	notes: roomsNotes,
}
