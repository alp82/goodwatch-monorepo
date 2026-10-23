import {
	IMPORT_MAX_ROWS,
	type ImportObservation,
	type ParsedImport,
} from "../../domain/imports.ts"
import type { EpisodeListRow } from "../tracking.server.ts"
import { ImportFileError } from "./files.server.ts"

/** Expand completion scopes before the shared episode resolver; snapshots never imply a repeat viewing. */
export async function expandWatcharrWatches(
	parsed: ParsedImport,
): Promise<void> {
	if (parsed.source !== "wishlist") return
	const expanded: ImportObservation[] = []
	const catalogs = new Map<number, Promise<EpisodeListRow[]>>()
	for (const row of parsed.observations) {
		if (
			row.kind !== "watch" ||
			row.mediaType !== "show" ||
			row.problem ||
			row.episode != null ||
			row.wishlistEvidence?.source !== "watcharr" ||
			!row.tmdbId
		) {
			expanded.push(row)
			continue
		}
		let catalog = catalogs.get(row.tmdbId)
		if (!catalog) {
			const { getEpisodeList } = await import("../tracking.server.ts")
			catalog = getEpisodeList(row.tmdbId)
			catalogs.set(row.tmdbId, catalog)
		}
		const episodes = (await catalog).filter(
			(e) =>
				(row.season == null
					? e.season_number > 0
					: e.season_number === row.season) &&
				// A source's bulk completion says nothing about future or undated episodes.
				e.air_date != null &&
				e.air_date <= Date.parse(row.watchedAt ?? new Date().toISOString()),
		)
		if (!episodes.length) {
			expanded.push({
				...row,
				problem: {
					outcome: "unmatched",
					reason: "No aired TMDB episodes match this Watcharr completion.",
				},
			})
			continue
		}
		if (expanded.length + episodes.length > IMPORT_MAX_ROWS)
			throw new ImportFileError(
				"That file produces more than 50,000 import items.",
			)
		for (const episode of episodes)
			expanded.push({
				...row,
				key: `${row.key}:episode:${episode.tmdb_id}`,
				episodeTmdbId: episode.tmdb_id,
				season: episode.season_number,
				episode: episode.episode_number,
				episodeNumbering: "tmdb",
			})
	}
	const identity = (row: ImportObservation) =>
		`${row.tmdbId}:${row.season}:${row.episode}`
	const history = new Set(
		expanded
			.filter(
				(row) =>
					row.kind === "watch" &&
					!row.problem &&
					!row.watcharrSnapshot &&
					row.wishlistEvidence?.source === "watcharr",
			)
			.map(identity),
	)
	const snapshots = new Set<string>()
	parsed.observations = expanded.filter((row) => {
		if (!row.watcharrSnapshot || row.problem) return true
		const key = identity(row)
		if (history.has(key) || snapshots.has(key)) return false
		snapshots.add(key)
		return true
	})
	if (parsed.observations.length > IMPORT_MAX_ROWS)
		throw new ImportFileError(
			"That file produces more than 50,000 import items.",
		)
}
