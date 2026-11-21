// PROTOTYPE - throwaway (prototype/explore-r8). Slot "blend-room", variant "Every part's room": a blend lights each
// family it mixes (Genres and Eras for comedies from the 1990s). Drawn by the rooms row; this View draws nothing.
import type { SlotVariant } from "../../contract"

export const variant: SlotVariant<never, object> = {
	id: "all",
	name: "Every part's room",
	what: "A blend lights the room of each family it mixes: comedies from the 1990s lights Genres and Eras.",
	order: 1,
	View: () => null,
}
