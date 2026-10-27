import { titleTypeOf } from "../domain/title-type.ts"
import { GENRE_COLOR } from "../domain/genre-colors.ts"
import { VALID_FINGERPRINT_KEYS } from "./utils/fingerprint.ts"
import { SCORE_BANDS } from "../utils/score-bands.ts"

const roles = new Set([
	"Acting",
	"Appearances",
	"Directing",
	"Writing",
	"Production",
	"Art",
	"Camera",
	"Costume & Make-Up",
	"Crew",
	"Other crew",
	"Editing",
	"Lighting",
	"Sound",
	"Visual Effects",
	"Actors",
])
const genres = new Set([
	...Object.keys(GENRE_COLOR),
	"Sci-Fi & Fantasy",
	"Action & Adventure",
	"War & Politics",
])
const traits = new Set<string>(VALID_FINGERPRINT_KEYS)
const scoreGroups = new Set([...SCORE_BANDS.map((band) => band.key), "unrated"])
const decade = (s: string) =>
	s === "upcoming" || /^(18[89]|19\d|20\d|210)0$/.test(s)

/** Canonical query spelling, before cache keys or profile work. Defaults, duplicates and unknowns disappear. */
export function normalizePersonQuery(input: URLSearchParams): URLSearchParams {
	const out = new URLSearchParams()
	const type = titleTypeOf(input.get("type"), input.get("anime"))
	if (type.format !== "all") out.set("type", type.format)
	if (type.anime !== "any") out.set("anime", type.anime)
	for (const [key, valid] of [
		["role", roles],
		["genre", genres],
	] as const) {
		const value = input.get(key)?.trim() ?? ""
		if (valid.has(value)) out.set(key, value)
	}
	const d = input.get("decade") ?? ""
	if (decade(d)) out.set("decade", d)
	const trait = input.get("trait") ?? ""
	if (traits.has(trait)) out.set("trait", trait)
	const score = Number(input.get("minScore"))
	if (Number.isFinite(score) && score > 0)
		out.set("minScore", String(Math.min(100, Math.trunc(score))))
	if (out.get("minScore") === "0") out.delete("minScore")
	if (input.get("group") === "score") out.set("group", "score")
	if (input.get("order") === "asc") out.set("order", "asc")
	const expand = input.get("expand") ?? ""
	if (out.get("group") === "score" ? scoreGroups.has(expand) : decade(expand))
		out.set("expand", expand)
	// Do not convert a data fetch into a document, nor send its transport parameter to profile/filter logic.
	const data = input.get("_data")
	if (data !== null) out.set("_data", data)
	return out
}

export function personTarget(target: string) {
	// Parse only origin-form person paths: this must never create an external redirect.
	const at = target.indexOf("?")
	const pathname = at < 0 ? target : target.slice(0, at)
	if (!/^\/person\/[^/]+\/?$/.test(pathname)) return null
	const query = normalizePersonQuery(
		new URLSearchParams(at < 0 ? "" : target.slice(at + 1)),
	)
	const semantic = new URLSearchParams(query)
	semantic.delete("_data")
	const search = query.toString()
	return {
		pathname,
		query,
		filters: [...semantic.keys()].length,
		target: pathname + (search ? "?" + search : ""),
	}
}
