// PROTOTYPE (Discover lab): the sections and one chosen variant per section, kept in the URL:
// `/prototype/discover-mood?variant=lab&mood=b&scores=c&sec=mood`. A missing section takes DEFAULTS, else its first
// variant. `sec` is the section the lab bar's arrows cycle.
import type { SectionId, Viewer } from "./types"

export const SECTIONS: { id: SectionId; name: string }[] = [
	{ id: "titles", name: "Search: titles" },
	{ id: "people", name: "Search: cast and crew" },
	{ id: "taste", name: "Search: your taste" },
	{ id: "mood", name: "Mood tab" },
	{ id: "services", name: "Watch: services" },
	{ id: "scores", name: "Watch: scores" },
	{ id: "origin", name: "Watch: made in" },
	{ id: "released", name: "Watch: released" },
	{ id: "length", name: "Watch: length" },
	{ id: "age", name: "Watch: age and content" },
]

/** The owner's picks so far. Empty: every section shows `a`, the baseline. */
export const DEFAULTS: Partial<Record<SectionId, string>> = {
	// Round 6 and 7 verdicts (2026-10-28, 2026-10-29).
	titles: "g",
	people: "c",
	taste: "a",
	mood: "e",
	services: "b",
	origin: "a",
	length: "d",
	scores: "a",
	released: "d",
	age: "a",
}

export type Choice = Partial<Record<SectionId, string>> & { sec: SectionId; as: Viewer }

export function choiceFromParams(params: URLSearchParams): Choice {
	const choice: Choice = { sec: "titles", as: params.get("as") === "member" ? "member" : "guest" }
	for (const s of SECTIONS) {
		const v = params.get(s.id)
		if (v) choice[s.id] = v
	}
	const sec = params.get("sec") as SectionId | null
	if (sec && SECTIONS.some((s) => s.id === sec)) choice.sec = sec
	return choice
}

export function paramsFromChoice(choice: Choice): URLSearchParams {
	const p = new URLSearchParams()
	p.set("variant", "lab")
	if (choice.as === "member") p.set("as", "member")
	for (const s of SECTIONS) {
		const v = choice[s.id]
		if (v) p.set(s.id, v)
	}
	p.set("sec", choice.sec)
	return p
}
