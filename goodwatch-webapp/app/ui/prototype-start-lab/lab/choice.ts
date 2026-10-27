// PROTOTYPE (start page lab, 2026-10-27): the lab's sections and the choice of one variant per section, kept in the
// URL: `/prototype/start-lab?as=guest&layout=band&hero=b&scene=sofa-shelves&tv=a...` (a missing section takes its
// first variant). `sec` is the section the bar's arrows cycle.

export type SectionId = "layout" | "hero" | "recs" | "scene" | "shelf" | "tv" | "how" | "browse" | "member"

export type Viewer = "guest" | "member"

export const SECTIONS: { id: SectionId; name: string; for: Viewer[] }[] = [
	{ id: "layout", name: "Page layout", for: ["guest"] },
	{ id: "hero", name: "Search hero", for: ["guest"] },
	{ id: "recs", name: "Recommendations", for: ["guest"] },
	{ id: "scene", name: "Room scene", for: ["guest", "member"] },
	{ id: "shelf", name: "Posters in the room", for: ["guest", "member"] },
	{ id: "tv", name: "TV and intro", for: ["guest", "member"] },
	{ id: "how", name: "How it works", for: ["guest"] },
	{ id: "browse", name: "Browse", for: ["guest"] },
	{ id: "member", name: "Member start", for: ["member"] },
]

export type Choice = Partial<Record<SectionId, string>> & { as: Viewer; sec: SectionId }

export function choiceFromParams(params: URLSearchParams): Choice {
	const as: Viewer = params.get("as") === "member" ? "member" : "guest"
	const choice: Choice = { as, sec: "hero" }
	for (const s of SECTIONS) {
		const v = params.get(s.id)
		if (v) choice[s.id] = v
	}
	const sec = params.get("sec") as SectionId | null
	choice.sec = sec && SECTIONS.some((s) => s.id === sec && s.for.includes(as)) ? sec : as === "member" ? "member" : "hero"
	return choice
}

export function paramsFromChoice(choice: Choice): URLSearchParams {
	const p = new URLSearchParams()
	p.set("as", choice.as)
	for (const s of SECTIONS) {
		const v = choice[s.id]
		if (v) p.set(s.id, v)
	}
	p.set("sec", choice.sec)
	return p
}
