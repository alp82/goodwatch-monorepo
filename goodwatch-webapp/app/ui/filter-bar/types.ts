import type { ReactNode } from "react"
import type { ViewerLadder } from "~/domain/age-content"
import type { FilterName } from "~/domain/filter-state"

/** What the title filter counted for the current state; the results endpoints return it (see FilterResult). */
export interface FilterBarCounts {
	total: number
	hidden: number
	/** Titles only that filter hides, largest first. */
	recoveries: { filter: FilterName; titles: number }[]
	/** What each option would leave, the others unchanged. */
	optionCounts: Record<FilterName, Record<string, number>>
	/** Per-service counts are missing while the viewer's country loads. */
	approximate?: boolean
	/**
	 * The viewer's rating country and its ladder, for the age limit's control. Null (or missing) when the age and
	 * content filter isn't available to the viewer: the control doesn't show.
	 */
	ladder?: ViewerLadder | null
}

/** The For you switch next to the sort (Discover). The surface owns its state and what it explains. */
export interface ForYouControl {
	on: boolean
	onChange: (on: boolean) => void
	/** The "↑N moved" count: how many titles For you moved up. */
	movedUp: number
	/** What the fingerprint icon explains, on hover, focus, or tap. */
	explanation: ReactNode
	/** Shown in the switch's place, for example the sign-up prompt for a guest without enough ratings. */
	replacement?: ReactNode
	/** The switch shows but can't be flipped yet, for example without enough liked titles. */
	disabled?: boolean
	/** A short line under For you in the phone sheet, for example "Close matches you'd rate highly rise". */
	hint?: string
	/** The line while it's off; "Same order for everyone" by default. */
	offHint?: string
	/**
	 * Turns For you off and applies a sort in one step: how a person leaves Best match through the switch. Without it
	 * the bar calls `onChange(false)`, then the sort's own change.
	 */
	onOffWithSort?: (sort: string) => void
}
