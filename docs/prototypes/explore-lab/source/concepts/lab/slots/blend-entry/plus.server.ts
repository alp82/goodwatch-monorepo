// PROTOTYPE - throwaway (prototype/explore-r5, slot "blend-entry", variant "plus"). The pantry for this place.
import type { PlaceRef } from "../../../../kit/types"
import type { PantryGroup } from "../../../blend/loader.server"
import type { SlotLoader } from "../../contract"
import { pantryOf } from "./shared.server"
import { startsBlend } from "./slot"

export interface EntryData {
	parts: PlaceRef[]
	pantry: PantryGroup[]
	partners: PlaceRef[]
}

export const load: SlotLoader<EntryData | null> = async ({ kit, address }) =>
	startsBlend(address)
		? {
				parts: address.parts.map((p) => kit.ref(p)),
				pantry: pantryOf(kit, address.parts),
				partners: [],
			}
		: null
