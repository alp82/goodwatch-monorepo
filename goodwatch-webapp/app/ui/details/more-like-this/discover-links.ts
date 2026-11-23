import { browsePath, categoryPath, ing, place, slugify } from "~/domain/browse/address"
import { MOOD_BY_KEY, type MoodKey, moodsOf } from "~/domain/moods"
import { titleKey } from "~/utils/title-key"
import type { PersonOption, Sources } from "./sources"

function discover(params: Record<string, string>, type?: "movie" | "show") {
	const out = new URLSearchParams(params)
	if (type) out.set("type", type)
	out.set("services", "all")
	return `/discover?${out}`
}

/** The series' own name ("Dune" of "The Dune series"), else its first film's title. */
export function seriesLink(src: Sources) {
	const s = src.series
	if (!s) return null
	const name = s.named ? s.name.replace(/ series$/, "").replace(/^The /, "") : s.titles[0].title
	return discover({ q: name })
}

/** The title's moods, the Feel ones first, up to Discover's three. */
export function feelMoods(src: Sources): MoodKey[] {
	const scores = src.media.fingerprint?.scores
	if (!scores) return []
	const all = moodsOf(scores, src.media.details.genres ?? [])
	return [
		...all.filter((m) => MOOD_BY_KEY[m].feel),
		...all.filter((m) => !MOOD_BY_KEY[m].feel),
	].slice(0, 3)
}

export function feelsLink(src: Sources) {
	const moods = feelMoods(src)
	if (!moods.length) return null
	return browsePath(
		place(
			src.type,
			moods.map((key) => ing("mood", slugify(MOOD_BY_KEY[key].name))),
		),
	)
}

export const similarLink = (src: Sources) =>
	discover({ similar: String(titleKey(src.type, src.id)) }, src.type)

export const personLink = (option: PersonOption) => discover({ people: String(option.id) })

export const genreLink = (src: Sources, genre: string | null) => {
	const name = genre ?? src.genres[0]
	return name ? categoryPath(src.type, "genre", name) : null
}
