import { canonicalTitleId } from "../../utils/title-identity.ts"
import {
	parseTitleKey,
	type TitleKey,
	titleKey,
} from "../../utils/title-key.ts"

import { personLink } from "./title-details.ts"

interface Credit {
	key: string
	media_type: "movie" | "show"
	tmdb_id: number
	roles: string[]
	release_year: number | null
	score: number | null
	popularity: number
	weight: number
}
/** Filter and sort the complete filmography before selecting a page; never mutate the cached credits. */
export function filmographyView<T extends Credit>(
	credits: readonly T[],
	args: { role?: string; sort?: string; exclude_seen?: boolean },
	seen: Iterable<TitleKey> = [],
	percentiles = new Map<string, number | null>(),
): T[] {
	const blocked = new Set(
		[...seen].map((key) => {
			const { mediaType, tmdbId } = parseTitleKey(key)
			return titleKey(mediaType, canonicalTitleId(mediaType, tmdbId))
		}),
	)
	const role = { acting: "Acting", directing: "Directing", writing: "Writing" }[
		args.role ?? "all"
	]
	const distinct = new Map<string, T>()
	for (const credit of credits) {
		if (role && !credit.roles.includes(role)) continue
		const id = canonicalTitleId(credit.media_type, credit.tmdb_id)
		if (args.exclude_seen && blocked.has(titleKey(credit.media_type, id)))
			continue
		const key = `${credit.media_type}:${id}`
		const existing = distinct.get(key)
		if (existing) {
			distinct.set(key, {
				...(credit.tmdb_id === id ? { ...credit, key } : existing),
				roles: [...new Set([...existing.roles, ...credit.roles])],
			})
		} else distinct.set(key, { ...credit, key, tmdb_id: id })
	}
	const metric = (
		a: number | null | undefined,
		b: number | null | undefined,
	) => (a == null || b == null ? (a === b ? 0 : a == null ? 1 : -1) : b - a)
	return [...distinct.values()].sort((a, b) => {
		const order =
			args.sort === "newest"
				? metric(a.release_year, b.release_year)
				: args.sort === "score"
					? metric(a.score, b.score)
					: metric(percentiles.get(a.key), percentiles.get(b.key))
		return (
			order ||
			b.weight - a.weight ||
			b.popularity - a.popularity ||
			a.key.localeCompare(b.key, "en")
		)
	})
}

export interface Person {
	tmdb_id: number
	name: string
	known_for_department: string | null
	profile_path?: string | null
}

export const personSummary = (person: Person, origin: string) => {
	const { id, ...linked } = personLink(
		{ id: person.tmdb_id, name: person.name },
		origin,
	)
	return {
		...linked,
		person_id: id,
		known_for_department: person.known_for_department,
	}
}
