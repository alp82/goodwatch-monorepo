// PROTOTYPE (Discover lab, scores a, round 10): Metacritic's user score as a lab-only choice. Discover's sourceScores
// has no key for it (the data exists server side as metacritic_user_score_*), so it doesn't narrow the list; the
// bar's Watch summary and the Scores badge still read it. 0 is Any, else 60/70/80/90 (6.0+ to 9.0+).
import { useSyncExternalStore } from "react"

let value = 0
const subs = new Set<() => void>()
const subscribe = (f: () => void) => {
	subs.add(f)
	return () => subs.delete(f)
}

export const mcUsers = () => value
export function setMcUsers(v: number) {
	value = v
	for (const f of subs) f()
}
export const useMcUsers = () => useSyncExternalStore(subscribe, mcUsers, () => 0)
