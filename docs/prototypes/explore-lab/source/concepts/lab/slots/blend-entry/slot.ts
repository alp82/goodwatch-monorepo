// PROTOTYPE - throwaway (prototype/explore-r5). Part slot "blend-entry": how a blend starts from a single place. It
// is drawn next to the title in every place head: `<Part slot="blend-entry" address={address} to={to} />`. The owner:
// blend "needs something better for how to navigate there"; making a combination was "cumbersome".
import type { Address } from "../../../../kit/address"
import type { SlotMeta } from "../../contract"

/** What a `blend-entry` variant's View receives (plus `data` from its loader). */
export interface EntryProps {
	address: Address
	/** The link of an address under the lab. */
	to: (a: Address, extra?: Record<string, string | undefined>) => string
}

/** A blend starts from one place: a mood, a genre, a decade, a country, a service, a subject or a style. */
export const startsBlend = (address: Address) =>
	address.view === "place" && address.parts.length === 1 && address.parts[0].family !== "trait"

export const slot: SlotMeta = {
	id: "blend-entry",
	label: "Blend entry",
	order: 20,
	group: "part",
	applies: startsBlend,
	fallback: "plus",
}
