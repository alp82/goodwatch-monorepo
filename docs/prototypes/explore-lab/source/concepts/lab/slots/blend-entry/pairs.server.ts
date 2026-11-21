// PROTOTYPE - throwaway (prototype/explore-r5, slot "blend-entry", variant "pairs"). Three ready partners and the pantry.
import type { SlotLoader } from "../../contract"
import type { EntryData } from "./plus.server"
import { pantryOf, partnersOf } from "./shared.server"
import { startsBlend } from "./slot"

export const load: SlotLoader<EntryData | null> = async ({ kit, address }) =>
	startsBlend(address)
		? {
				parts: address.parts.map((p) => kit.ref(p)),
				pantry: pantryOf(kit, address.parts),
				partners: await partnersOf(kit, address.parts),
			}
		: null
