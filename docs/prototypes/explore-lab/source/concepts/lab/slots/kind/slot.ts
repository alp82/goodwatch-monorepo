// PROTOTYPE - throwaway (prototype/explore-r5). Part slot "kind": the control at the start of the rooms row that chooses movies, shows, or
// both together (`/all/...`). The owner: "a clever way to have both movies and shows selectable ... like a small extra
// control, because they shouldn't work like normal checkboxes."
import type { Address, Kind } from "../../../../kit/address"
import type { SlotMeta } from "../../contract"

/** What a `kind` variant's View receives. It renders in the sticky rooms row (44px tall) and in the phone's row. */
export interface KindProps {
	address: Address
	/** The link of an address under the lab. */
	to: (a: Address) => string
	/** Movies, shows, both: the same page for each, and which one the address is on. */
	kinds: { kind: Kind; label: string; href: string; on: boolean }[]
}

export const slot: SlotMeta = {
	id: "kind",
	label: "Kind",
	order: 1,
	group: "part",
	applies: () => true,
	fallback: "ampersand",
}
