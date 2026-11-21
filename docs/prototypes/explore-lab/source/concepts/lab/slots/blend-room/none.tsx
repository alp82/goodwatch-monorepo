// PROTOTYPE - throwaway (prototype/explore-r8). Slot "blend-room", variant "No room": a blend belongs to no single
// room, so the row lights none; the title (each part underlined) says where you are. Drawn by the rooms row.
import type { SlotVariant } from "../../contract"

export const variant: SlotVariant<never, object> = {
	id: "none",
	name: "No room",
	what: "A blend lights no room in the row; its title, with each part underlined, says where you are.",
	order: 2,
	View: () => null,
}
