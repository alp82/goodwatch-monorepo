// PROTOTYPE (Discover lab): the sections and one chosen variant per section, kept in the URL:
// `/prototype/discover-mood?v-mood=b&sec=mood`. A missing or unknown key takes DEFAULTS, else the section's first
// variant. `sec` is the section the lab bar's arrows cycle. Round 20 locked every section to its pick (one variant
// each), so the bar lists only sections a later round gives more than one variant.
import type { SectionId, Viewer } from "./types"

export const SECTIONS: { id: SectionId; name: string }[] = [
	{ id: "layout", name: "Main tabs" },
	{ id: "header", name: "Tab header and search" },
	{ id: "titles", name: "Search: titles" },
	{ id: "people", name: "Search: cast and crew" },
	{ id: "taste", name: "Search: You" },
	{ id: "mood", name: "Mood tab" },
	{ id: "services", name: "Watch: services" },
	{ id: "scores", name: "Watch: scores" },
	{ id: "origin", name: "Watch: made in" },
	{ id: "released", name: "Watch: released" },
	{ id: "length", name: "Watch: length" },
	{ id: "age", name: "Watch: age and content" },
	{ id: "more", name: "Watch: popularity, money, shows" },
]

/** The owner's picks. A section without one shows its first variant. */
export const DEFAULTS: Partial<Record<SectionId, string>> = {
	// Round 6 and 7 verdicts (2026-10-28, 2026-10-29), locked in round 20.
	layout: "c",
	// Round 21 (open): how the header search shows its results.
	header: "a",
	titles: "g",
	people: "c",
	taste: "f",
	mood: "k",
	services: "b",
	origin: "a",
	length: "d",
	scores: "a",
	released: "f",
	age: "a",
	more: "g",
}

export type Choice = Partial<Record<SectionId, string>> & { sec: SectionId; as: Viewer }

/** Section keys carry a prefix: Discover's own filters also use `released`, `services` and `people`. */
const key = (id: SectionId) => `v-${id}`

export function choiceFromParams(params: URLSearchParams): Choice {
	const choice: Choice = { sec: "titles", as: params.get("as") === "member" ? "member" : "guest" }
	for (const s of SECTIONS) {
		const v = params.get(key(s.id))
		if (v) choice[s.id] = v
	}
	const sec = params.get("sec") as SectionId | null
	if (sec && SECTIONS.some((s) => s.id === sec)) choice.sec = sec
	return choice
}

/** The URL for a choice. `only`: the sections worth writing (the lab bar passes those with more than one variant). */
export function paramsFromChoice(choice: Choice, only: SectionId[] = SECTIONS.map((s) => s.id)): URLSearchParams {
	const p = new URLSearchParams()
	p.set("variant", "lab")
	if (choice.as === "member") p.set("as", "member")
	for (const id of only) {
		const v = choice[id]
		if (v) p.set(key(id), v)
	}
	if (only.includes(choice.sec)) p.set("sec", choice.sec)
	return p
}
