// PROTOTYPE - throwaway (prototype/explore-r5). What a lab slot is. The lab is one concept whose pages are built from
// slots; each slot has variants, picked separately in the lab panel. Files are found by name, so a builder only
// writes inside its own slot folders:
//
//   concepts/lab/slots/<slot>/slot.ts               export const slot: SlotMeta
//   concepts/lab/slots/<slot>/<variant>.tsx         export const variant: SlotVariant<Data>
//   concepts/lab/slots/<slot>/<variant>.server.ts   export const load: SlotLoader<Data>      (optional)
//
// Pure types: safe in the browser.
import type { ComponentType } from "react"
import type { Address } from "../../kit/address"
import type { ConceptPageProps, LoadArgs, Note } from "../../kit/contract"

export interface SlotMeta {
	/** The folder's name. */
	id: string
	/** The panel's name for the slot: "Hub", "Place cards". */
	label: string
	/** Position in the panel among slots of the same group (lower first). */
	order?: number
	/**
	 * "page": its variant renders the whole page body under the rooms row (exactly one page slot applies to an
	 * address). "part": a piece that pages render with `<Part slot="..." />` or read with `useLab().pick("...")`.
	 */
	group: "page" | "part"
	/**
	 * Page slots: whether this slot renders the address (use `pageSlotOf(address) === id`).
	 * Part slots: whether the panel offers the slot on this address.
	 */
	applies(address: Address): boolean
	/** The variant shown when nothing is picked. */
	fallback: string
}

/** The picks of this request: every known slot has one. */
export interface Lab {
	/** slot id → variant id, resolved (an unknown or missing pick is the slot's fallback). */
	picks: Record<string, string>
	pick(slot: string): string
}

/** What a page slot's `View` receives: the concept page props with the variant's own data, and the picks. */
export interface PageViewProps<D = unknown> extends ConceptPageProps<D> {
	lab: Lab
}

/**
 * A variant. `P` is the props of its `View`: `PageViewProps<Data>` for a page slot; for a part slot whatever the
 * slot's `slot.ts` documents (the `card` slot: `CardProps`).
 */
export interface SlotVariant<D = unknown, P = PageViewProps<D>> {
	/** The file's name. `r4` is the round 4 pick, the baseline to beat. */
	id: string
	/** The panel's pill: what the variant tries, in two or three words ("Grid first", "Atlas"). Never "A/B/C". */
	name: string
	/** One line for the panel: what this variant tries. */
	what: string
	/** Position among the slot's variants (lower first; `r4` is always first). */
	order?: number
	View: ComponentType<P>
	/** Page slots: what each element on the page means, for the notes panel. */
	notes?: (props: P) => Note[]
}

/** A variant's server loader: the concept loader's arguments and the picks. */
export type SlotLoader<D = unknown> = (args: LoadArgs & { lab: Lab }) => Promise<D>

/** What the lab's own loader returns. */
export interface LabData {
	/** The page slot that renders this address, and its picked variant. */
	slot: string
	variant: string
	picks: Record<string, string>
	/** The page variant's data. */
	data: unknown
	/** Data of the part slots whose picked variant has a loader, by slot id. */
	parts: Record<string, unknown>
}
