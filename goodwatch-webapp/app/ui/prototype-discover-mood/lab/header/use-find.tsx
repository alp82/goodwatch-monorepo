// PROTOTYPE (Discover lab, round 21): the header search as the shell uses it. The text lives in the shell's tab state
// (it stays while you switch tabs, closing the panel clears it); this hook finds the hits, picks them as the header
// variant says, and hands the shell its results, the c badges and the sub-tab rule.
import { useRef } from "react"
import type { ProtoDiscover } from "../../kit"
import { useLabChoice } from "../LabBar"
import { pick } from "../registry"
import type { Layout, SegKey, SubId } from "../layouts"
import { type Pieces, subsFor } from "../shell-parts"
import { useSubLabel } from "../shell-tabs"
import type { HeaderKey } from "../sections/header"
import type { Nav } from "./field"
import { type Hit, useHits } from "./hits"
import { pulseLabel } from "./pulse"
import { FindResults, matchCounts } from "./results"

interface TabMoves {
	find: string
	setFind: (t: string) => void
	/** Opens a tab, at a sub-tab when given. */
	go: (k: SegKey, sub?: SubId) => void
	setSub: (k: SegKey, id: SubId) => void
}

export function useFind(d: ProtoDiscover, pieces: Pieces, L: Layout, order: SegKey[], t: TabMoves, onJump?: () => void) {
	const choice = useLabChoice()
	const variant = pick(choice, "header").key as HeaderKey
	const nav = useRef<Nav | null>(null)
	const label = useSubLabel()
	const found = useHits(d, pieces, choice.as, L, t.find)
	const subsOf = (seg: SegKey) => subsFor(seg, pieces, L)
	const hits = found.hits.filter((h) => subsOf(h.seg).some((s) => s.id === h.sub))
	const counts = variant === "c" && found.active ? matchCounts(hits) : null

	const onPick = (h: Hit) => {
		if (variant !== "b") {
			if (!h.locked) h.toggle()
			return
		}
		// b: toggle, then go where it lives and mark it there. A locked one only goes (You shows how to sign up).
		if (!h.locked) h.toggle()
		t.setFind("")
		onJump?.()
		t.go(h.seg, h.sub)
		pulseLabel(h.label)
	}

	return {
		variant,
		nav,
		active: found.active,
		/** The results for the open tab, or null while the field holds too little. */
		results: (seg: SegKey, sub: SubId, phone: boolean) =>
			found.active ? (
				<FindResults
					variant={variant}
					hits={hits}
					loading={found.loading}
					text={t.find}
					seg={seg}
					sub={sub}
					order={order}
					subsOf={subsOf}
					label={label}
					phone={phone}
					onPick={onPick}
					nav={nav}
				/>
			) : null,
		/** c: match counts per tab and sub-tab while searching. */
		segMatches: counts?.seg,
		subMatches: counts?.sub,
		/** a and b: the results dim the sub-tabs, and a sub-tab tap ends the search. c keeps it and leads with that sub-tab. */
		dim: found.active && variant !== "c",
		onSub: (seg: SegKey, id: SubId) => {
			if (variant !== "c") t.setFind("")
			t.setSub(seg, id)
		},
	}
}
