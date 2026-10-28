// PROTOTYPE (start page lab, 2026-10-27): the lab's sections and the choice of one variant per section, kept in the
// URL: `/prototype/start-lab?as=guest&stage=a&scene=nook-stage&tv=a...` (a missing section takes the round's
// default, else its first variant). `sec` is the section the bar's arrows cycle. `round=1` shows round 1.
//
// Round 1: layout + hero + recs + how + browse for guests. Round 2 (default): the stage (search and tap three on
// the room) + how + browse, and new member pages; the owner's round 1 picks are the defaults.

export type SectionId = "layout" | "stage" | "hero" | "recs" | "scene" | "shelf" | "tv" | "how" | "browse" | "member" | "persona" | "searchbar" | "light" | "flow"

export type Viewer = "guest" | "member"
export type Round = 1 | 2

export const SECTIONS: { id: SectionId; name: string; for: Viewer[]; rounds: Round[] }[] = [
	{ id: "flow", name: "Opening flow", for: ["guest"], rounds: [2] }, // Round 17: the old TV's boot, then the page (sections/flow)
	{ id: "stage", name: "Search + tap three", for: ["guest"], rounds: [2] }, // Round 15: open again (j, l, m)
	{ id: "layout", name: "Page layout", for: ["guest"], rounds: [1] },
	{ id: "hero", name: "Search hero", for: ["guest"], rounds: [1] },
	{ id: "recs", name: "Recommendations", for: ["guest"], rounds: [1] },
	{ id: "member", name: "Member start", for: ["member"], rounds: [1] },
	{ id: "persona", name: "Member data", for: ["member"], rounds: [2] },
	{ id: "searchbar", name: "Search bar", for: ["guest"], rounds: [2] },
	{ id: "light", name: "Mood lighting", for: ["guest"], rounds: [2] },
	{ id: "scene", name: "Room scene", for: ["guest", "member"], rounds: [1, 2] },
	{ id: "shelf", name: "Posters in the room", for: ["guest", "member"], rounds: [1, 2] },
	{ id: "tv", name: "TV and intro", for: ["guest"], rounds: [1] },
	{ id: "how", name: "How it works", for: ["guest"], rounds: [1] },
	{ id: "browse", name: "Browse", for: ["guest"], rounds: [1] },
]

/** The owner's round 1 picks (2026-10-27) start round 2. */
export const DEFAULTS: Record<Round, Partial<Record<SectionId, string>>> = {
	1: {},
	// Round 16: stage m (the mood button) is the default; j and l stay in the bar.
	// Round 15: stage l (the mood picker with mixes on the stage) was the default.
	// Round 14: mood lighting e (sections/light) is the default.
	// Round 6: the owner's picks: stage j, browse d, member d (rounds 1-5 verdicts in BRIEF.md).
	// Round 17: opening flow "none" (today's page, no boot) unless the bar picks one.
	2: { scene: "nook-r15-a", shelf: "h", tv: "a", how: "b", stage: "m", browse: "d", member: "d", persona: "full", searchbar: "d", light: "e", flow: "none" },
}

export type Choice = Partial<Record<SectionId, string>> & { as: Viewer; sec: SectionId; round: Round }

export const sectionsFor = (as: Viewer, round: Round) => SECTIONS.filter((s) => s.for.includes(as) && s.rounds.includes(round))

export function choiceFromParams(params: URLSearchParams): Choice {
	const as: Viewer = params.get("as") === "member" ? "member" : "guest"
	const round: Round = params.get("round") === "1" ? 1 : 2
	const choice: Choice = { as, round, sec: "stage" }
	for (const s of SECTIONS) {
		const v = params.get(s.id)
		if (v) choice[s.id] = v
	}
	const visible = sectionsFor(as, round)
	const sec = params.get("sec") as SectionId | null
	choice.sec = sec && visible.some((s) => s.id === sec) ? sec : (visible[0]?.id ?? "member")
	return choice
}

export function paramsFromChoice(choice: Choice): URLSearchParams {
	const p = new URLSearchParams()
	p.set("as", choice.as)
	if (choice.round === 1) p.set("round", "1")
	for (const s of SECTIONS) {
		const v = choice[s.id]
		if (v) p.set(s.id, v)
	}
	p.set("sec", choice.sec)
	// PROTOTYPE · Round 14: keep the effect explorer's `fx` (sections/light/explorer) across bar changes.
	if (typeof window !== "undefined") {
		const fx = new URLSearchParams(window.location.search).get("fx")
		if (fx !== null) p.set("fx", fx)
	}
	return p
}
