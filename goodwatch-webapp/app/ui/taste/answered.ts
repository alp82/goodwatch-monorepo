// Which titles a person has already answered, for the pages that ask one title at a time (/taste/quiz, the TV's
// quiz, the Taste page's start) and the picks they show after. A title the person scored, skipped, put on Want to
// See, marked Not interested or has a watch state for is never asked about again, and never offered as a pick.
//
// Pure, so the tests run it as it is.
import { ACTED_ON, type UserData } from "../../types/user-data.ts"

/** The titles a member's account has answered: every "already acted on" list of their marks (`ACTED_ON`). */
export function accountAnsweredKeys(
	data: Pick<UserData, (typeof ACTED_ON)[number]> | null | undefined,
): Set<string> {
	const keys = new Set<string>()
	if (!data) return keys
	for (const list of ACTED_ON)
		for (const key of Object.keys(data[list] ?? {})) keys.add(key)
	return keys
}

/**
 * How many titles a request for more titles names as already answered or shown. Higher than any guest's progress
 * and a full first queue (300), so a batch never brings back titles left out of the list; a long list is sent as a
 * POST body (`fetchSmartTitles`).
 */
export const EXCLUDE_LIMIT = 600

export type ExcludeItem = { media_type: string; tmdb_id: number }

/**
 * The titles to leave out of the next batch of titles to ask about, newest last: those answered (oldest first),
 * then those already queued. Each once, and only the most recent `limit`, so the request stays a bounded size.
 */
export function excludeIdsFor(
	answered: readonly string[],
	queued: readonly string[] = [],
	limit = EXCLUDE_LIMIT,
): ExcludeItem[] {
	const ordered: string[] = []
	const seen = new Set<string>()
	// From the newest back, so a key keeps its latest place.
	const all = [...answered, ...queued]
	for (let i = all.length - 1; i >= 0 && ordered.length < limit; i--) {
		const key = all[i]
		if (seen.has(key)) continue
		seen.add(key)
		ordered.push(key)
	}
	return ordered.reverse().flatMap((key) => {
		const [media_type, id] = key.split("-")
		const tmdb_id = Number(id)
		return media_type && Number.isFinite(tmdb_id) ? [{ media_type, tmdb_id }] : []
	})
}
