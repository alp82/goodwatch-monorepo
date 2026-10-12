// One presentation for ratings and tracking. Provider positions never replace the canonical tracking identity.
export interface CatalogEpisode {
	id: number
	season: number
	number: number
	name: string | null
	airDate?: number | null
	runtime?: number | null
	still?: string | null
	overview?: string | null
}
export interface ImdbEpisodeRating {
	id: string
	parentId: string
	season: number | null
	number: number | null
	name: string | null
	score: number | null
	votes: number | null
}
export interface EpisodeMapping {
	showId: number
	version: string
	imdbParentId: string
	entries: readonly {
		id: number
		canonical: readonly [number, number]
		display: readonly [number, number]
		imdbId: string
		/** Reviewed provider titles, including translation aliases. A conflicting later edit is unresolved. */
		reviewedNames: readonly [string | null, string | null]
	}[]
}
export interface PresentedEpisode extends CatalogEpisode {
	displaySeason: number
	displayNumber: number
	rating: number | null
	votes: number
	resolved: boolean
}
export type EpisodePresentation = {
	version: string
	active: boolean
	note: string | null
	episodes: PresentedEpisode[]
	seasons: {
		number: number
		ids: number[]
		score: number | null
		rated: number
		total: number
		unresolved: number
	}[]
}
const norm = (name: string | null) =>
	(name ?? "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")
const position = (e: CatalogEpisode) => [e.season, e.number] as const
const compare = (a: readonly number[], b: readonly number[]) =>
	a[0] - b[0] || a[1] - b[1]
const unique = (values: readonly (number | string)[]) =>
	new Set(values).size === values.length

/** A snapshot identifier for stale-action detection; membership is separately checked by the server. */
function version(
	mapping: EpisodeMapping,
	catalog: readonly CatalogEpisode[],
	active: boolean,
): string {
	let hash = 2166136261
	const shape = [...catalog]
		.sort((a, b) => a.id - b.id)
		.map((e) => `${e.id}:${e.season}:${e.number}:${e.airDate ?? ""}`)
		.join(";")
	for (const char of shape)
		hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
	return `${mapping.version}-${active ? "aligned" : "canonical"}-${(hash >>> 0).toString(36)}`
}

export function buildEpisodePresentation(
	catalog: readonly CatalogEpisode[],
	imdb: readonly ImdbEpisodeRating[],
	mapping: EpisodeMapping,
): EpisodePresentation {
	const entries = mapping.entries
	const byId = new Map(catalog.map((e) => [e.id, e]))
	const mapped = new Map(entries.map((e) => [e.id, e]))
	const ordered = [...entries].sort((a, b) => compare(a.canonical, b.canonical))
	const last = ordered.at(-1)?.canonical
	const validEntries =
		unique(entries.map((e) => e.id)) &&
		unique(entries.map((e) => e.imdbId)) &&
		unique(entries.map((e) => e.display.join(":"))) &&
		unique(entries.map((e) => e.canonical.join(":"))) &&
		entries.every(
			(e) =>
				e.canonical.every((n) => Number.isInteger(n) && n > 0) &&
				e.display.every((n) => Number.isInteger(n) && n > 0),
		)
	const monotonic = ordered.every(
		(e, index) =>
			index === 0 || compare(ordered[index - 1].display, e.display) < 0,
	)
	const active =
		validEntries &&
		monotonic &&
		unique(catalog.map((e) => e.id)) &&
		unique(catalog.map((e) => position(e).join(":"))) &&
		entries.every(
			(e) =>
				!byId.has(e.id) ||
				compare(position(byId.get(e.id)!), e.canonical) === 0,
		) &&
		catalog.every(
			(e) =>
				e.season === 0 ||
				mapped.has(e.id) ||
				Boolean(last && compare(position(e), last) > 0),
		)
	const positions = new Map<string, number>()
	const ratingPosition = (e: ImdbEpisodeRating) =>
		`${e.parentId}:${e.season}:${e.number}`
	for (const e of imdb)
		positions.set(
			ratingPosition(e),
			(positions.get(ratingPosition(e)) ?? 0) + 1,
		)
	const rated = new Map<string, ImdbEpisodeRating | null>()
	for (const e of imdb) rated.set(e.id, rated.has(e.id) ? null : e)
	let additional = 0
	const episodes = [...catalog]
		.sort((a, b) => compare(position(a), position(b)))
		.map((e) => {
			const entry = mapped.get(e.id)
			const source = entry && rated.get(entry.imdbId)
			const resolved = Boolean(
				validEntries &&
					entry &&
					source &&
					source.parentId === mapping.imdbParentId &&
					positions.get(ratingPosition(source)) === 1 &&
					source.season === entry.display[0] &&
					source.number === entry.display[1] &&
					(norm(source.name) === norm(e.name) ||
						(norm(e.name) === norm(entry.reviewedNames[0]) &&
							norm(source.name) === norm(entry.reviewedNames[1]))),
			)
			const score =
				resolved && source?.score && source.score > 0 ? source.score : null
			return {
				...e,
				displaySeason:
					e.season === 0 ? 0 : active ? (entry?.display[0] ?? -1) : e.season,
				displayNumber:
					e.season === 0
						? e.number
						: active
							? (entry?.display[1] ?? ++additional)
							: e.number,
				rating: score,
				votes: score !== null ? Math.max(0, source?.votes ?? 0) : 0,
				resolved: e.season === 0 || resolved,
			}
		})
	const numbers = [
		...new Set(
			episodes.filter((e) => e.season > 0).map((e) => e.displaySeason),
		),
	].sort((a, b) => Number(a < 0) - Number(b < 0) || a - b)
	const seasons = numbers.map((number) => {
		const members = episodes.filter((e) => e.displaySeason === number)
		const unresolved = members.filter((e) => !e.resolved).length
		const scored = members.filter((e) => e.rating !== null)
		const votes = scored.reduce((sum, e) => sum + e.votes, 0)
		return {
			number,
			ids: members.map((e) => e.id),
			rated: scored.length,
			total: members.length,
			unresolved,
			score:
				!unresolved && votes > 0
					? Math.round(
							(scored.reduce((sum, e) => sum + e.rating! * e.votes, 0) /
								votes) *
								100,
						) / 100
					: null,
		}
	})
	return {
		version: version(mapping, catalog, active),
		active,
		episodes,
		seasons,
		note: !active
			? "Episode numbering could not be aligned. Using TMDB's numbering."
			: seasons.some((s) => s.unresolved)
				? "Some episode ratings could not be matched safely."
				: null,
	}
}
