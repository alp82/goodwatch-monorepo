// Run by loved-storage.test.ts through vite-node: loves and undoes titles with the guest's real progress store
// (utils/guest-progress.ts) over an in-memory localStorage, and prints what `onboarding_ratings` holds after each step.
import { ONBOARDING_RATINGS_KEY } from "~/ui/taste/constants"
import { createLovedThree } from "./loved-three"
import { guestLovedStore } from "./useLovedThree"

const items = new Map<string, string>()
const target = new EventTarget()
Object.assign(globalThis, {
	window: Object.assign(target, {
		location: { hostname: "localhost", search: "", pathname: "/" },
	}),
	localStorage: {
		getItem: (k: string) => items.get(k) ?? null,
		setItem: (k: string, v: string) => void items.set(k, v),
		removeItem: (k: string) => void items.delete(k),
	},
})
let limitShown = 0
target.addEventListener("goodwatch:guest-rating-limit", () => {
	limitShown++
})

const stored = () =>
	(
		JSON.parse(items.get(ONBOARDING_RATINGS_KEY) ?? "[]") as {
			media_type: string
			tmdb_id: number
			type: string
			score?: number
		}[]
	).map((i) => `${i.media_type}:${i.tmdb_id}:${i.type}:${i.score ?? ""}`)
const title = (tmdb_id: number, media_type: "movie" | "show" = "movie") => ({
	key: (media_type === "movie" ? 1e12 : 2e12) + tmdb_id,
	media_type,
	tmdb_id,
})

const three = createLovedThree({ store: guestLovedStore, onChange: () => {} })
const steps: Record<string, unknown> = {}
three.toggle(title(603))
three.toggle(title(1396, "show"))
steps.loved = stored()
three.toggle(title(603))
steps.undone = stored()
// A title the guest had marked before: undo puts the mark back.
items.set(
	ONBOARDING_RATINGS_KEY,
	JSON.stringify([
		{ media_type: "movie", tmdb_id: 7, type: "plan", timestamp: 1 },
	]),
)
three.reset()
three.toggle(title(7))
steps.overMark = stored()
three.toggle(title(7))
steps.markBack = stored()
// Three loved, then a new choice: the slots empty, the scores stay.
for (const id of [1, 2, 3]) three.toggle(title(id))
three.choice()
steps.afterChoice = { slots: three.loved().length, stored: stored() }
// The guest's 20 ratings: the store refuses and shows its prompt.
items.set(
	ONBOARDING_RATINGS_KEY,
	JSON.stringify(
		Array.from({ length: 20 }, (_, i) => ({
			media_type: "movie",
			tmdb_id: 500 + i,
			type: "score",
			score: 8,
			timestamp: 1,
		})),
	),
)
steps.refused = three.toggle(title(42))
steps.limitShown = limitShown
console.log(`__LOVED_STORAGE__${JSON.stringify(steps)}`)
