// Find in title asks, a section answers: picking a person asks Cast or Crew (over a small per-page bus) to search for
// them and ring their row. Sections that don't listen are simply scrolled to.
import {
	type RefObject,
	createContext,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { flash } from "~/ui/details/find/highlight"

export type FindRequest =
	| { type: "person"; kind: "cast" | "crew"; id: number; name: string }
	| { type: "cast-search"; q: string }

export interface FindBusValue {
	send: (r: FindRequest) => void
	on: (fn: (r: FindRequest) => void) => () => void
}

export const FindBus = createContext<FindBusValue | null>(null)

/** A bus for one page; hand it down with `<FindBus.Provider value={bus}>`. */
export function useFindBusValue(): FindBusValue {
	return useMemo<FindBusValue>(() => {
		const target = new EventTarget()
		return {
			send: (r) => target.dispatchEvent(new CustomEvent("req", { detail: r })),
			on: (fn) => {
				const h = (e: Event) => fn((e as CustomEvent<FindRequest>).detail)
				target.addEventListener("req", h)
				return () => target.removeEventListener("req", h)
			},
		}
	}, [])
}

/** Calls `fn` for every request on the page's bus (the latest `fn`, without subscribing again). No bus, no calls. */
export function useFindRequests(fn: (r: FindRequest) => void) {
	const bus = useContext(FindBus)
	const ref = useRef(fn)
	ref.current = fn
	useEffect(() => bus?.on((r) => ref.current(r)), [bus])
}

/** Classes for a person's `<li>` while find rings it. */
export const RINGED =
	"rounded-lg transition-colors duration-500 data-[ringed]:bg-amber-300/10 data-[ringed]:ring-1 data-[ringed]:ring-amber-300/50"

/**
 * Rings a person's row in `root` once `ready` (their search has answered): the flash centers it, and the row's `<li>`
 * gets `data-ringed` for a moment (style it with RINGED). Returns `ring(id)`, to call with the request.
 */
export function useRingPerson(root: RefObject<HTMLElement>, ready: boolean) {
	const target = useRef<number | null>(null)
	const timer = useRef(0)
	// A request for the search already on screen changes no state; this tick still runs the effect.
	const [, setTick] = useState(0)
	useEffect(() => {
		const id = target.current
		if (id == null || !ready) return
		target.current = null
		requestAnimationFrame(() =>
			requestAnimationFrame(() => {
				const el = root.current?.querySelector<HTMLElement>(
					`[data-person-id="${id}"]`,
				)
				const li = el?.closest("li") as HTMLElement | null
				if (!el || !li) return
				flash(li)
				li.dataset.ringed = ""
				window.clearTimeout(timer.current)
				timer.current = window.setTimeout(() => {
					delete li.dataset.ringed
				}, 2600)
			}),
		)
	})
	return (id: number) => {
		target.current = id
		setTick((n) => n + 1)
	}
}
