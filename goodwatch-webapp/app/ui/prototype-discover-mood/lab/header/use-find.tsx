// PROTOTYPE (Discover lab, round 21, locked to "results in place" in round 22): the header search as the shell uses
// it. The text lives in the shell's tab state (it stays while you switch tabs, closing the panel clears it); this hook
// finds the hits and hands the shell its results. A pick toggles in place and the field keeps its text.
import { useRef } from "react"
import type { ProtoDiscover } from "../../kit"
import { useLabChoice } from "../LabBar"
import type { Layout, SegKey, SubId } from "../layouts"
import { type Pieces, subsFor } from "../shell-parts"
import { useSubLabel } from "../shell-tabs"
import type { Nav } from "./field"
import { seedFindPerson } from "../sections/people/c"
import { type Hit, VALUE_CAP, useHits } from "./hits"
import { FindResults } from "./results"

interface TabMoves {
	find: string
	setFind: (t: string) => void
	/** Opens a tab, at a sub-tab when given. */
	go: (k: SegKey | null, sub?: SubId) => void
	setSub: (k: SegKey, id: SubId) => void
	/** The bar's search text, which Search's Titles reads. */
	setText: (t: string) => void
}

/** `onOpenFull`: after a group opens in its sub-tab (phones close the field there). */
export function useFind(d: ProtoDiscover, pieces: Pieces, L: Layout, order: SegKey[], t: TabMoves, onOpenFull?: () => void) {
	const choice = useLabChoice()
	const nav = useRef<Nav | null>(null)
	const label = useSubLabel()
	const found = useHits(d, pieces, choice.as, L, t.find)
	const subsOf = (seg: SegKey) => subsFor(seg, pieces, L)
	const shown = found.hits.filter((h) => subsOf(h.seg).some((s) => s.id === h.sub))
	// A few value readings, the likeliest first.
	const values = new Set(shown.filter((h) => h.value).sort((a, b) => b.score - a.score).slice(0, VALUE_CAP))
	const hits = shown.filter((h) => !h.value || values.has(h))
	const onPick = (h: Hit) => {
		if (!h.locked) h.toggle()
	}

	return {
		nav,
		active: found.active,
		/** The results for the open tab, or null while the field holds too little. */
		results: (phone: boolean) =>
			found.active ? (
				<FindResults
					hits={hits}
					totals={found.totals}
					loading={found.loading}
					text={t.find}
					order={order}
					subsOf={subsOf}
					label={label}
					phone={phone}
					onPick={onPick}
					nav={nav}
					onOpenFull={(kind) => {
						// The full search in its own sub-tab with the text in its field: Titles reads the bar's
						// field, Cast and crew gets it in Find a person.
						const q = t.find.trim()
						if (kind === "title") t.setText(q)
						else seedFindPerson(q)
						t.setFind("")
						t.go("search", kind === "title" ? "titles" : "people")
						onOpenFull?.()
					}}
				/>
			) : null,
		/** The results dim the sub-tabs, and a sub-tab tap ends the search. */
		dim: found.active,
		onSub: (seg: SegKey, id: SubId) => {
			t.setFind("")
			t.setSub(seg, id)
		},
	}
}
