// Where each block's Show all in More like this's expanded view goes: Discover (/discover) with the filters that come
// nearest to that shelf, in Discover's own URL parameters (domain/filter-state.ts filterStateFromParams). Every link
// says services=all, as the shelves show titles whatever they stream on (Discover's default for a member is their own
// services).
//   Watch order    q=<series name>   Discover has no collection filter: the nearest is a search for the series' name ("Dune")
//   Feels the same moods=<its moods>&all=moods  Discover can't filter by fingerprint effects; the title's moods (each
//                  a rule over the fingerprint, domain/moods.ts), Feel moods first, up to three, all of them at once
//   Similar        similar=<title key>  Discover's "similar to" filter, the same nearest-titles search
//   Same person    people=<TMDB person id>  Discover's people filter is cast or crew (not this one role)
//   Same genre     genres=<genre>     the one genre
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
	const name = s.named
		? s.name.replace(/ series$/, "").replace(/^The /, "")
		: s.titles[0].title
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
	return discover(
		{ moods: moods.join(","), ...(moods.length > 1 ? { all: "moods" } : {}) },
		src.type,
	)
}

export const similarLink = (src: Sources) =>
	discover({ similar: String(titleKey(src.type, src.id)) }, src.type)

export const personLink = (option: PersonOption) =>
	discover({ people: String(option.id) })

export const genreLink = (src: Sources, genre: string | null) => {
	const name = genre ?? src.genres[0]
	return name ? discover({ genres: name }, src.type) : null
}
