// PROTOTYPE (start page lab): the "browse" section's variants, in bar order.
import type { BlockVariant } from "../../lab/types"
import { Chips } from "./chips"
import { NoBrowse } from "./none"
import { TalkedHubs } from "./talked-hubs"

export const VARIANTS: BlockVariant[] = [
	{ key: "a", name: "Hub chips", C: Chips },
	{ key: "b", name: "Talked about + hubs", C: TalkedHubs },
	{ key: "c", name: "None", C: NoBrowse },
]
