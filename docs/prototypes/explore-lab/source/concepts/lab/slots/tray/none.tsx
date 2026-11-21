// PROTOTYPE - throwaway (prototype/explore-r5, slot "tray"). No tray: a blend is made on a place's own page.
import type { SlotVariant } from "../../contract"
import type { TrayProps } from "./slot"

export const variant: SlotVariant<never, TrayProps> = {
	id: "none",
	name: "None",
	what: "No tray. A blend is made on a place's own page.",
	order: 0,
	View: () => null,
}
