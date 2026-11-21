// PROTOTYPE - throwaway (prototype/explore-r6, bodies r8). Page slot "trope": one trope's page (/movies/tropes/chekhovs-gun).
// Data and pieces live with the index, in ../tropes (model.ts, model.server.ts, parts.tsx).
import type { SlotMeta } from "../../contract"
import { pageSlotOf } from "../../pages"

export const slot: SlotMeta = {
	id: "trope",
	label: "Trope",
	order: 16,
	group: "page",
	applies: (address) => pageSlotOf(address) === "trope",
	fallback: "parts",
}
