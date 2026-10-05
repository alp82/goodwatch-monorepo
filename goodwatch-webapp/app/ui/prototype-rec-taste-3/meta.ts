// PROTOTYPE - throwaway. What each section of the Taste page is called and how it introduces itself
// (a one-line teaser and a title to show) in the overview, the rail and the chapters.
import type { Payload3, Title } from "./model"

export type SectionMeta = {
	id: string
	label: string
	teaser: (d: Payload3) => string
	/** Titles that could stand for this section, best first; sectionTitles picks one per section without repeats. */
	candidates: (d: Payload3) => (string | undefined)[]
}


export const bestEra = (d: Payload3) =>
	[...d.report.eras]
		.filter((e) => e.count >= 4)
		.sort((a, b) => b.avg - a.avg)[0]
export const bestMood = (d: Payload3) =>
	[...d.report.moods].sort((a, b) => b.delta - a.delta)[0]

export const SECTION_META: SectionMeta[] = [
	{
		id: "overview",
		label: "Overview",
		teaser: (d) => d.report.archetype.name,
		candidates: (d) => d.report.canon.map((c) => c.key),
	},
	{
		id: "sides",
		label: "Sides of you",
		teaser: (d) =>
			d.report.sides.length
				? `${d.report.sides.length} sides, and what lies just past each`
				: "Rate more titles to find your sides",
		candidates: (d) => d.report.sides.flatMap((s) => s.titles.slice(0, 3)),
	},
	{
		id: "crowd",
		label: "You vs everyone",
		teaser: (d) => d.report.crowd.stance,
		candidates: (d) => d.report.crowd.higher.map((r) => r.key),
	},
	{
		id: "canon",
		label: "Your canon",
		teaser: (d) =>
			d.report.canon.length
				? `${d.report.canon.length} titles that define you`
				: "Rate a few titles 9 or 10",
		candidates: (d) => [...d.report.canon.slice(1), d.report.canon[0]].map((c) => c?.key),
	},
	{
		id: "eras",
		label: "Eras",
		teaser: (d) => {
			const e = bestEra(d)
			return e ? `Your best decade is the ${e.decade}s` : "Your decades"
		},
		candidates: (d) => bestEra(d)?.top ?? [],
	},
	{
		id: "moods",
		label: "Moods",
		teaser: (d) => {
			const m = bestMood(d)
			return m ? `Happiest with ${m.name.toLowerCase()}` : "Your moods"
		},
		candidates: (d) => bestMood(d)?.top ?? [],
	},
	{
		id: "people",
		label: "People",
		teaser: (d) => {
			const p = d.report.people.directors[0]
			return p ? `You keep coming back to ${p.name}` : "Directors you return to"
		},
		candidates: (d) => d.report.people.directors.flatMap((p) => p.keys),
	},
]

/** One title per section, never the same one twice, so the overview and the rail don't repeat a poster. */
export function sectionTitles(d: Payload3) {
	const used = new Set<string>()
	const out: Record<string, Title | undefined> = {}
	for (const s of SECTION_META) {
		const keys = s.candidates(d).filter((k): k is string => !!k && !!d.items[k])
		const key = keys.find((k) => !used.has(k)) ?? keys[0]
		if (key) used.add(key)
		out[s.id] = key ? d.items[key] : undefined
	}
	return out
}

export const sectionIds = SECTION_META.map((s) => s.id)
