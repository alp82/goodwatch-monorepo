// The current browser-history entry owns its return state. Fresh visits and
// other searches do not inherit a previous recommendation session.
import type { TitleCard } from "~/server/title-cards.server"
import type { GuestPick } from "~/ui/taste/guest-pick"
import type { TasteInteraction } from "~/ui/taste/types"
import type { LovedSnapshot } from "./loved-three"
export type RecommendationView = {
	active: number
	scrollLeft: number
	scrollY: number
}
export type StartReturn = {
	version: 1
	url: string
	loved: LovedSnapshot<TitleCard, TasteInteraction[]>
	pick: GuestPick
	view: RecommendationView
}
const KEY = "goodwatchStartReturn"
export function readStartReturn(): StartReturn | null {
	if (typeof window === "undefined") return null
	const saved = window.history.state?.[KEY] as StartReturn | undefined
	return saved?.version === 1 &&
		saved.url === window.location.pathname + window.location.search &&
		Array.isArray(saved.loved?.loved) &&
		Array.isArray(saved.loved?.before) &&
		saved.pick &&
		saved.view
		? saved
		: null
}
export function saveStartReturn(value: Omit<StartReturn, "version" | "url">) {
	try {
		window.history.replaceState(
			{
				...window.history.state,
				[KEY]: {
					...value,
					version: 1,
					url: window.location.pathname + window.location.search,
				},
			},
			"",
		)
	} catch {
		/* Navigation still works if the browser cannot keep a snapshot. */
	}
}
export function clearStartReturn() {
	if (typeof window === "undefined" || !window.history.state?.[KEY]) return
	const next = { ...window.history.state }
	delete next[KEY]
	window.history.replaceState(next, "")
}
