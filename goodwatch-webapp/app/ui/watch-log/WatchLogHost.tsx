// The movie watch log's place in the page (REC_TRACKING): one host in the app shell that a Seen button on any
// surface hands its press to. The host is all a first view loads. What the press does (the watch for now and its
// toast, or the log in a popover or a sheet) is in WatchLogSurface, fetched on intent and at the first press.
//
// One host for the page, not one per button: a card that leaves its list when its movie becomes Seen would take its
// toast, with Undo and "Change date", along.
import { Suspense, lazy, useEffect, useId, useSyncExternalStore } from "react"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

/** One press of a movie's Seen button, or a request to open its log. */
export interface SeenPress {
	/** Distinct for every press. */
	id: number
	movie: { tmdbId: number; title: string }
	/** The button, which the popover opens beside and the focus returns to. */
	anchor: HTMLElement | null
	/** The movie was Seen at the press: the log opens. Otherwise the press records a watch for now. */
	seen: boolean
}

const loadSurface = reloadOnStaleChunk(() => import("./WatchLogSurface"))
const WatchLogSurface = lazy(loadSurface)

/** Fetches the log's code ahead of the press. Call it when the pointer or the focus reaches a Seen button. */
export function warmWatchLog() {
	void loadSurface().catch(() => {})
}

let press: SeenPress | null = null
let serial = 0
// The hosts on the page, in the order they mounted. The last one answers: a surface that brings its own member
// (the development harness) mounts one inside it.
let hosts: string[] = []
const listeners = new Set<() => void>()
const changed = () => {
	for (const listener of listeners) listener()
}
const subscribe = (listener: () => void) => {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

/** Hands a press of a movie's Seen button to the host. */
export function pressSeen(next: Omit<SeenPress, "id">) {
	press = { ...next, id: ++serial }
	changed()
}

export function WatchLogHost() {
	const id = useId()
	useEffect(() => {
		hosts = [...hosts, id]
		changed()
		return () => {
			hosts = hosts.filter((host) => host !== id)
			changed()
		}
	}, [id])
	const current = useSyncExternalStore(
		subscribe,
		() => (hosts[hosts.length - 1] === id ? press : null),
		() => null,
	)
	// Stays mounted after the first press, so its toast and its open log outlive the next one.
	if (!current) return null
	return (
		<Suspense fallback={null}>
			<WatchLogSurface press={current} />
		</Suspense>
	)
}
