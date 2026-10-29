// PROTOTYPE (Discover lab, round 9): a mood variant may replace Discover's list (mood i: every pick ANDed). Its hook
// runs in a host that stays mounted while the panel is closed, so the grid keeps the list after Show N titles.
import { createContext, useContext, useEffect, useRef, useState } from "react"
import type { ProtoDiscover } from "../kit"
import { useLabChoice } from "./LabBar"
import { pick } from "./registry"
import type { ResultsView } from "./types"

const Shown = createContext<ResultsView | null>(null)

/** `d` with the variant's list in place of Discover's (total, counts, cards, paging); `d` itself when there's none. */
export function withView(d: ProtoDiscover, v: ResultsView | null): ProtoDiscover {
	if (!v) return d
	const counts = d.counts && v.total !== null ? { ...d.counts, total: v.total, hidden: d.counts.hidden + d.counts.total - v.total } : d.counts
	return { ...d, total: v.total, counts, cards: v.cards, loading: v.loading, hasMore: v.hasMore, loadMore: v.loadMore }
}

/** For the footer and the status line inside the shell. */
export const useShown = (d: ProtoDiscover) => withView(d, useContext(Shown))

function Host({ use, d, onView }: { use: (d: ProtoDiscover) => ResultsView | null; d: ProtoDiscover; onView: (v: ResultsView | null) => void }) {
	const v = use(d)
	const now = useRef(v)
	now.current = v
	const sig = v ? `${v.total}|${v.loading}|${v.hasMore}|${v.cards.map((c) => c.key).join(",")}` : ""
	// biome-ignore lint/correctness/useExhaustiveDependencies: the signature stands for the list
	useEffect(() => onView(now.current), [sig])
	useEffect(() => () => onView(null), [onView])
	return null
}

/** Runs the mood variant's list hook and hands its list to everything under it. */
export function ResultsProvider({ d, children }: { d: ProtoDiscover; children: (shown: ProtoDiscover) => React.ReactNode }) {
	const mood = pick(useLabChoice(), "mood")
	const [view, setView] = useState<ResultsView | null>(null)
	return (
		<Shown.Provider value={view}>
			{mood.useResults && <Host key={mood.key} use={mood.useResults} d={d} onView={setView} />}
			{children(withView(d, view))}
		</Shown.Provider>
	)
}
