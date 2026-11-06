// A title's award mark, from TVDB's reported results (view doc.tvdb_award_display; contract in docs/tvdb-pipelines.md,
// "Award quality and display contract"). Coverage is partial, so a mark never counts: a poster card and a best-of row
// say the most notable body the title has a reported win at ("Oscar winner"), and the quick view lists a few of the
// title's most notable results. A title without a win gets no mark; a title without rows gets nothing at all. Results
// belong to the title: a category in a year, never a person.
// No imports, so `node --test` runs its tests directly and the client can share it.

/** The bodies in prestige order; any other ranks after them. The short name is what a card says. */
const BODIES: readonly (readonly [award: string, short: string])[] = [
	["Academy Awards", "Oscar"],
	["Primetime Emmy Awards", "Emmy"],
	["Golden Globe Awards", "Golden Globe"],
	["BAFTA Awards", "BAFTA"],
	["César Awards", "César"],
	["Screen Actors Guild Awards", "SAG Award"],
	["Directors Guild of America Awards", "DGA Award"],
	["Writers Guild of America Awards", "WGA Award"],
	["Producers Guild of America Awards", "PGA Award"],
	["Critics' Choice Awards", "Critics' Choice"],
	["Baeksang Arts Awards", "Baeksang"],
	["Canadian Screen Awards", "Canadian Screen Award"],
	["Daytime Emmy Awards", "Daytime Emmy"],
	["National Television Awards", "NTA"],
	["MTV Movie & TV Awards", "MTV Award"],
	["Gemini Awards", "Gemini"],
	["Genie Awards", "Genie"],
]

const prestigeOf = (award: string) => {
	const i = BODIES.findIndex(([name]) => name === award)
	return i < 0 ? BODIES.length : i
}

export const shortAwardName = (award: string) =>
	BODIES.find(([name]) => name === award)?.[1] ?? award

/** The categories that are the title's own headline result (best picture, best series), ahead of the crafts. */
const HEADLINE =
	/picture|best film|feature film|(drama|comedy|limited|anthology|television|tv|new) series|^outstanding (drama|comedy|limited)|series –/i

export interface AwardMarkRow {
	award_name: string
	category_name: string
	ceremony_year: string
	has_win: boolean
	has_nomination: boolean
}

/** One reported result of the title, as the quick view lists it. */
export interface NotableAward {
	/** The body's short name: "Oscar". */
	award: string
	category: string
	year: string
	won: boolean
}

/** How many results the quick view lists. */
export const NOTABLE_RESULTS = 3

/** The short name of the most notable body the title has a reported win at; null without a win. */
export function topWin(rows: readonly AwardMarkRow[]): string | null {
	let best: string | null = null
	let bestRank = Number.POSITIVE_INFINITY
	for (const row of rows) {
		if (!row.has_win) continue
		const rank = prestigeOf(row.award_name)
		if (
			rank < bestRank ||
			(rank === bestRank && best != null && row.award_name < best)
		) {
			best = row.award_name
			bestRank = rank
		}
	}
	return best == null ? null : shortAwardName(best)
}

/**
 * The title's most notable reported results: its wins, or its nominations when it has no win. By prestige, then the
 * headline categories, then the newest year; one result per body before a second at the same body, so the list shows
 * the range first. Empty for a title without rows.
 */
export function notableAwards(
	rows: readonly AwardMarkRow[],
	limit = NOTABLE_RESULTS,
): NotableAward[] {
	const wins = rows.filter((r) => r.has_win)
	const pool = wins.length ? wins : rows.filter((r) => r.has_nomination)
	const sorted = [...pool].sort(
		(a, b) =>
			prestigeOf(a.award_name) - prestigeOf(b.award_name) ||
			a.award_name.localeCompare(b.award_name, "en") ||
			Number(HEADLINE.test(b.category_name)) -
				Number(HEADLINE.test(a.category_name)) ||
			String(b.ceremony_year).localeCompare(String(a.ceremony_year)) ||
			a.category_name.localeCompare(b.category_name, "en"),
	)
	const firsts: AwardMarkRow[] = []
	const rest: AwardMarkRow[] = []
	const bodies = new Set<string>()
	for (const r of sorted) {
		if (bodies.has(r.award_name)) rest.push(r)
		else {
			bodies.add(r.award_name)
			firsts.push(r)
		}
	}
	return [...firsts, ...rest].slice(0, limit).map((r) => ({
		award: shortAwardName(r.award_name),
		category: r.category_name,
		year: String(r.ceremony_year),
		won: r.has_win,
	}))
}

/** "Oscar winner". */
export const winnerLabel = (short: string) => `${short} winner`

export type AwardMediaType = "movie" | "show"

export const awardKey = (mediaType: AwardMediaType, tmdbId: number) =>
	`${mediaType}:${tmdbId}`

/**
 * Every title's mark, as the browser loads it once: per media type, per short name, the TMDB ids ascending (they
 * compress well). Only titles with a win are in it.
 */
export type AwardMarksPayload = Record<AwardMediaType, Record<string, number[]>>

export function encodeAwardMarks(
	marks: Iterable<readonly [AwardMediaType, number, string]>,
): AwardMarksPayload {
	const payload: AwardMarksPayload = { movie: {}, show: {} }
	for (const [mediaType, tmdbId, short] of marks) {
		const ids = payload[mediaType][short] ?? []
		ids.push(tmdbId)
		payload[mediaType][short] = ids
	}
	for (const byShort of Object.values(payload))
		for (const ids of Object.values(byShort)) ids.sort((a, b) => a - b)
	return payload
}

/** The payload as a lookup by `awardKey`. Tolerates a missing or malformed part. */
export function decodeAwardMarks(payload: unknown): Map<string, string> {
	const marks = new Map<string, string>()
	if (!payload || typeof payload !== "object") return marks
	for (const mediaType of ["movie", "show"] as const) {
		const byShort = (payload as Record<string, unknown>)[mediaType]
		if (!byShort || typeof byShort !== "object") continue
		for (const [short, ids] of Object.entries(byShort)) {
			if (!Array.isArray(ids)) continue
			for (const id of ids)
				if (Number.isSafeInteger(id)) marks.set(awardKey(mediaType, id), short)
		}
	}
	return marks
}
