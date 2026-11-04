// The effects picked for the Feels the same shelf, per title, outside React's tree: the shelf on the page and its block
// in the expanded view show the same pick, and it survives the shelf's remounts. null until someone picks: the shelf
// then shows the title's rarest pair (startSelection on the cached pairs answer).
import { useCallback, useSyncExternalStore } from "react"

const picks = new Map<number, string[] | null>()
const listeners = new Set<() => void>()
const subscribe = (fn: () => void) => {
	listeners.add(fn)
	return () => listeners.delete(fn)
}

export function useMixPick(tmdbId: number) {
	const picked = useSyncExternalStore(
		subscribe,
		() => picks.get(tmdbId) ?? null,
		() => null,
	)
	const setPicked = useCallback(
		(next: string[] | null) => {
			picks.set(tmdbId, next)
			for (const fn of listeners) fn()
		},
		[tmdbId],
	)
	return [picked, setPicked] as const
}
