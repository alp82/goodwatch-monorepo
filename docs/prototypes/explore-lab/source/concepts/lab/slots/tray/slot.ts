// PROTOTYPE - throwaway (prototype/explore-r5). Part slot "tray": something that holds ingredients while you browse,
// so a blend can be put together across pages. The lab's frame draws it once on every page:
// `<Part slot="tray" address={address} to={to} />`. The owner: "easy to jump between different combos"; making a
// combination was "cumbersome".
import type { Address } from "../../../../kit/address"
import type { SlotMeta } from "../../contract"

/** What a `tray` variant's View receives (plus `data` from its loader). */
export interface TrayProps {
	address: Address
	/** The link of an address under the lab. */
	to: (a: Address, extra?: Record<string, string | undefined>) => string
}

export const TRAY_COOKIE = "gw-tray"

export const slot: SlotMeta = {
	id: "tray",
	label: "Blend tray",
	order: 21,
	group: "part",
	applies: () => true,
	fallback: "none",
}
