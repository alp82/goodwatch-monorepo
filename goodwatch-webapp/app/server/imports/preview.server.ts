import { createHash, randomUUID } from "node:crypto"
import type {
	ImportItem,
	ImportKind,
	ImportObservation,
	ImportOutcome,
	ImportSource,
	ImportSummary,
	ParsedImport,
} from "~/domain/imports"
import { canonicalTitleId } from "~/utils/title-identity"
import {
	IMPORT_MAX_ROWS,
	IMPORT_SHOW_STATUS_LABELS,
	IMPORT_SOURCE_NAMES,
	canImportWantToSee,
	isApplicableStatus,
} from "../../domain/imports.ts"
import { PROTECTED_STATES } from "../../domain/tracking/machine.ts"
import type {
	ImportStatusItem,
	ImportTrackingPlan,
} from "../tracking.server.ts"
import {
	createCatalogAnimeLookup,
	resolveAnimeParent,
} from "./anime-mapping-data.server.ts"
import {
	createCatalogEpisodeResolver,
	createTvdbParentLookup,
} from "./episode-resolver-data.server.ts"
import { ImportFileError, parseImportFile } from "./files.server.ts"
import {
	type Param,
	chunks,
	getImportRow,
	marks,
	refreshImports,
	refreshItems,
	run,
	select,
	summarize,
} from "./store.server.ts"
import { TVDB_LOOKUP_LIMITS } from "./tvdb-lookup.server.ts"
import { createTvtimeCatalogLookup } from "./tvtime-catalog.server.ts"
import {
	isManuallyMatchableWishlistSource,
	wishlistSourceGroup,
} from "./wishlist-evidence.server.ts"

const key = (type: "movie" | "show", id: number) => `${type}:${id}`
type CatalogRow = {
	tmdb_id: number
	imdb_id: string | null
	title: string
	release_year: number | null
}

async function matchCatalog(source: ImportSource, rows: ImportObservation[]) {
	const animeMappings = createCatalogAnimeLookup()
	const lookup =
		source === "tvtime" ? await createTvtimeCatalogLookup(rows) : undefined
	const resolveEpisode = createCatalogEpisodeResolver(animeMappings, lookup)
	const tvdbParent = createTvdbParentLookup(lookup)
	const unavailableParents = new Map<
		ImportObservation,
		NonNullable<ImportObservation["problem"]>
	>()
	if (source === "tvtime")
		for (const batch of chunks(rows, TVDB_LOOKUP_LIMITS.concurrency))
			await Promise.all(
				batch.map(async (row) => {
					if (row.problem || row.tmdbId != null) return
					if (row.mediaType === "movie" && !row.imdbId) {
						row.problem = {
							outcome: "unmatched",
							code: row.tvtimeMovie
								? "tvtime_movie_identity_missing"
								: "tvtime_movie_imdb_missing",
							reason: row.tvtimeMovie
								? "This TV Time movie has no catalog ID. Choose a movie to match it."
								: "This TV Time movie has no IMDb ID, so it wasn't matched.",
						}
						return
					}
					if (row.mediaType !== "show") return
					const identity = row.showTvdbId
						? `show:${row.showTvdbId}`
						: row.episodeTvdbId
							? `episode:${row.episodeTvdbId}`
							: null
					const parent = identity
						? await tvdbParent(identity)
						: { status: "unmatched" as const }
					if (parent.status === "matched") row.tmdbId = parent.showId
					if (parent.status === "unavailable")
						unavailableParents.set(row, parent.problem)
					if (parent.status === "unavailable" && !row.imdbId) {
						row.problem = parent.problem
						return
					}
					if (!row.tmdbId && !row.imdbId)
						row.problem = {
							outcome: "unmatched",
							code: "tvtime_show_unmatched",
							reason:
								"This TV Time show could not be matched uniquely by its TVDB identity. Its episodes and status were not applied.",
						}
				}),
			)
	// Tracker identities locate the parent; episode placement is validated separately below.
	for (const row of rows) {
		if (
			row.animeEntry &&
			row.kind === "unsupported" &&
			row.score != null &&
			row.problem?.outcome === "unsupported"
		) {
			const placement = await resolveEpisode.animeEntryPlacement(row.animeEntry)
			row.animeScorePlacement = placement
			row.tmdbId = placement.mapping?.showId ?? null
			if (placement.reason) row.problem.reason += ` ${placement.reason}`
			continue
		}
		if (row.animeEntry && (row.kind === "rating" || row.kind === "review")) {
			row.problem = {
				outcome: "unsupported",
				reason:
					"Anime cour ratings and reviews cannot be applied to the whole show.",
			}
			continue
		}
		if (
			!row.animeEntry ||
			row.problem ||
			row.mediaType !== "show" ||
			row.tmdbId != null
		)
			continue
		const parent = await resolveAnimeParent(row.animeEntry, animeMappings)
		if (parent.status === "matched") row.tmdbId = parent.mapping.showId
		else row.problem = { outcome: "unmatched", reason: parent.reason }
	}
	const found = new Map<
		number,
		{ tmdbId: number; mediaType: "movie" | "show" }
	>()
	for (const type of ["movie", "show"] as const) {
		const typed = rows
			.map((row, index) => ({ row, index }))
			.filter((x) => x.row.mediaType === type && !x.row.problem)
		const tmdbCandidates = new Map<number, CatalogRow>()
		const tmdbIds = [
			...new Set(
				typed.flatMap((x) =>
					x.row.tmdbId ? [canonicalTitleId(type, x.row.tmdbId)] : [],
				),
			),
		]
		for (const batch of chunks(tmdbIds, 800)) {
			const result = await select<CatalogRow>(
				`SELECT tmdb_id, imdb_id, title, release_year FROM ${type} WHERE tmdb_id IN (${marks(batch.length)})`,
				batch,
			)
			const byId = new Map(
				result.map((candidate) => [Number(candidate.tmdb_id), candidate]),
			)
			for (const x of typed) {
				if (!x.row.tmdbId) continue
				const tmdbId = canonicalTitleId(type, x.row.tmdbId)
				const candidate = byId.get(tmdbId)
				if (!candidate) continue
				tmdbCandidates.set(x.index, candidate)
				found.set(x.index, { tmdbId, mediaType: type })
			}
		}
		const imdbIds = [
			...new Set(
				typed
					.filter(
						(x) =>
							(!found.has(x.index) ||
								(source === "wishlist" && x.row.kind === "want")) &&
							x.row.imdbId &&
							!x.row.wishlistResolution,
					)
					.flatMap((x) =>
						typeof x.row.imdbId === "string" ? [x.row.imdbId] : [],
					),
			),
		]
		for (const batch of chunks(imdbIds, 800)) {
			const result = await select<CatalogRow>(
				`SELECT tmdb_id, imdb_id, title, release_year FROM ${type} WHERE imdb_id IN (${marks(batch.length)})`,
				batch,
			)
			for (const x of typed) {
				if (x.row.problem || !x.row.imdbId || x.row.wishlistResolution) continue
				const matches = result.filter((r) => r.imdb_id === x.row.imdbId)
				const tmdb = tmdbCandidates.get(x.index)
				if (
					source === "wishlist" &&
					x.row.kind === "want" &&
					tmdb &&
					matches.some(
						(match) =>
							canonicalTitleId(type, Number(match.tmdb_id)) !==
							canonicalTitleId(type, Number(tmdb.tmdb_id)),
					)
				) {
					const seen = new Set<number>()
					const candidates = [tmdb, ...matches]
						.filter((candidate) => {
							const id = canonicalTitleId(type, Number(candidate.tmdb_id))
							if (seen.has(id)) return false
							seen.add(id)
							return true
						})
						.map((candidate, index) => ({
							suppliedId: index === 0 ? ("tmdb" as const) : ("imdb" as const),
							mediaType: type,
							tmdbId: canonicalTitleId(type, Number(candidate.tmdb_id)),
							title: candidate.title,
							year: candidate.release_year,
						}))
					x.row.wishlistMatchRequired = "id_conflict"
					x.row.wishlistIdConflict = { candidates, suggestion: null }
					x.row.problem = {
						outcome: "unmatched",
						reason:
							"The supplied TMDB and IMDb IDs identify different titles. Choose a match.",
					}
					found.delete(x.index)
					continue
				}
				if (!found.has(x.index) && matches.length === 1)
					found.set(x.index, {
						tmdbId: canonicalTitleId(type, Number(matches[0].tmdb_id)),
						mediaType: type,
					})
			}
		}
		// Letterboxd has no stable ID in some CSVs. Exact title and year is the sole safe fallback.
		const titleMatches = new Map<string, CatalogRow[]>()
		if (source === "letterboxd" || source === "csv" || source === "wishlist")
			for (const x of typed) {
				if (
					x.row.problem ||
					found.has(x.index) ||
					x.row.wishlistResolution ||
					x.row.year === null ||
					!x.row.title.trim()
				)
					continue
				const lookup = `${x.row.title.trim().toLocaleLowerCase()}:${x.row.year}`
				let result = titleMatches.get(lookup)
				if (!result) {
					result = await select<CatalogRow>(
						`SELECT tmdb_id, imdb_id, title, release_year FROM ${type} WHERE lower(title) = lower(?) AND release_year = ? LIMIT 2`,
						[x.row.title.trim(), x.row.year],
					)
					titleMatches.set(lookup, result)
				}
				if (result.length === 1)
					found.set(x.index, {
						tmdbId: canonicalTitleId(type, Number(result[0].tmdb_id)),
						mediaType: type,
					})
			}
	}
	for (const [index, row] of rows.entries())
		if (unavailableParents.has(row) && !found.has(index))
			row.problem = unavailableParents.get(row)
	for (const batch of chunks(
		[...found],
		source === "tvtime" ? TVDB_LOOKUP_LIMITS.concurrency : 1,
	))
		await Promise.all(
			batch.map(async ([index, title]) => {
				const row = rows[index]
				// Wishlist season/episode rows reuse episode-scope fields as source evidence;
				// their target is the whole show, so they must skip episode resolution.
				if (
					(source === "wishlist" && row.kind === "want") ||
					title.mediaType !== "show" ||
					(row.episodeTmdbId == null &&
						!(row.animeEntry && row.kind === "watch") &&
						row.episodeTvdbId == null &&
						!row.episodeGroup &&
						!row.episodeName &&
						row.season == null &&
						row.episode == null)
				)
					return
				const result = await resolveEpisode({
					...row,
					showId: title.tmdbId,
					numbering: row.episodeNumbering,
				})
				if (result.status === "unmatched") {
					found.delete(index)
					row.problem = {
						outcome: "unmatched",
						reason: result.reason,
						...(result.code ? { code: result.code } : {}),
					}
				} else {
					if (result.datePolicy && row.kind === "watch") {
						row.watchedAt = result.watchedAt ?? null
						row.precision = result.datePolicy
					}
					row.episodeTmdbId = result.episodeTmdbId
					row.season = result.season
					row.episode = result.episode
					if (result.special) row.episodeSpecial = true
				}
			}),
		)

	return found
}

async function currentValues(userId: string) {
	await run(
		"REFRESH TABLE user_score, user_wishlist, user_favorite, user_watch_log, user_watch_state",
	)
	const [scores, wants, favorites, watched] = await Promise.all([
		select<{
			tmdb_id: number
			media_type: "movie" | "show"
			score: number | null
			review: string | null
			updated_at: Date | string
			_seq_no: number
			_primary_term: number
		}>(
			"SELECT tmdb_id, media_type, score, review, updated_at, _seq_no, _primary_term FROM user_score WHERE user_id = ? LIMIT 100000",
			[userId],
		),
		select<{ tmdb_id: number; media_type: "movie" | "show" }>(
			"SELECT tmdb_id, media_type FROM user_wishlist WHERE user_id = ? LIMIT 100000",
			[userId],
		),
		select<{ tmdb_id: number; media_type: "movie" | "show" }>(
			"SELECT tmdb_id, media_type FROM user_favorite WHERE user_id = ? LIMIT 100000",
			[userId],
		),
		select<{ tmdb_id: number; media_type: "movie" | "show" }>(
			"SELECT DISTINCT tmdb_id, media_type FROM user_watch_log WHERE user_id = ? LIMIT 100000",
			[userId],
		),
	])
	return {
		scores: new Map(
			scores.map((x) => [
				key(x.media_type, Number(x.tmdb_id)),
				{
					score: x.score === null ? null : Number(x.score),
					review: x.review,
					updatedAt: new Date(x.updated_at).toISOString(),
					seq: Number(x._seq_no),
					term: Number(x._primary_term),
				},
			]),
		),
		wants: new Set(wants.map((x) => key(x.media_type, Number(x.tmdb_id)))),
		favorites: new Set(
			favorites.map((x) => key(x.media_type, Number(x.tmdb_id))),
		),
		watched: new Set(watched.map((x) => key(x.media_type, Number(x.tmdb_id)))),
	}
}

async function classifyWatchDuplicates(
	userId: string,
	source: ImportSource,
	id: string,
	items: ImportItem[],
) {
	const groups = new Map<string, ImportItem[]>()
	for (const item of items.filter(
		(x) => x.kind === "watch" && x.outcome === "new" && x.tmdbId !== null,
	)) {
		const ref = `${item.mediaType}:${item.tmdbId}`
		groups.set(ref, [...(groups.get(ref) ?? []), item])
	}
	const plans = new Map<string, ImportTrackingPlan>()
	if (!groups.size) return plans
	const { prepareImportTrackingPlan } = await import("./tracking.server.ts")
	for (const group of groups.values()) {
		const first = group[0]
		if (!first || first.tmdbId === null) continue
		const plan = await prepareImportTrackingPlan({
			userId,
			importId: id,
			source,
			tmdbId: first.tmdbId,
			mediaType: first.mediaType,
			items: group,
			watchDates: "preserve",
			now: Date.now(),
		})
		plans.set(`${first.mediaType}:${first.tmdbId}`, plan)
		const kept = new Set(plan.keptKeys)
		for (const item of group)
			if (kept.has(item.key)) {
				item.outcome = "unchanged"
				item.reason = [
					item.reason,
					"This watch is already in your GoodWatch watch log.",
				]
					.filter(Boolean)
					.join(" ")
			}
	}
	return plans
}

function classify(
	rows: ImportObservation[],
	matched: Map<number, { tmdbId: number; mediaType: "movie" | "show" }>,
	current: Awaited<ReturnType<typeof currentValues>>,
): ImportItem[] {
	return rows.map((row, index): ImportItem => {
		const base = {
			...row,
			index,
			reason: row.episodeSpecial
				? "This episode maps to a TMDB special. It is imported but does not count toward regular show progress."
				: null,
			currentScore: null,
		}
		if (row.problem)
			return {
				...base,
				outcome: row.problem.outcome,
				...(row.problem.outcome === "unmatched" ? { tmdbId: null } : {}),
				reason: row.problem.reason,
			}
		const title = matched.get(index)
		if (!title)
			return {
				...base,
				tmdbId: null,
				outcome: "unmatched",
				reason:
					"This title could not be matched uniquely in the GoodWatch catalog.",
			}
		const ref = key(title.mediaType, title.tmdbId)
		const known = current.scores.get(ref)
		if (row.kind === "rating") {
			if (row.score === null || row.score === undefined)
				return {
					...base,
					...title,
					outcome: "invalid",
					reason: "This rating has no value.",
				}
			if (known?.score === row.score)
				return {
					...base,
					...title,
					currentScore: known.score,
					outcome: "unchanged",
					_preview: known,
				} as ImportItem
			return {
				...base,
				...title,
				currentScore: known?.score ?? null,
				outcome: known?.score == null ? "new" : "conflict",
				reason:
					known?.score == null
						? null
						: `You rated this ${known.score} in GoodWatch.`,
				_preview: known ?? null,
			} as ImportItem
		}
		if (row.kind === "review") {
			if (!row.review?.trim())
				return {
					...base,
					...title,
					outcome: "invalid",
					reason: "This review is empty.",
				}
			if (known?.review === row.review)
				return {
					...base,
					...title,
					outcome: "unchanged",
					_preview: known,
				} as ImportItem
			return {
				...base,
				...title,
				outcome: known?.review ? "conflict" : "new",
				reason: known?.review
					? "You already have a different review in GoodWatch."
					: null,
				_preview: known ?? null,
			} as ImportItem
		}
		if (
			row.kind === "want" ||
			(row.kind === "show_status" && row.showStatus === "plan_to_watch")
		)
			return {
				...base,
				...title,
				outcome: current.wants.has(ref)
					? "unchanged"
					: current.watched.has(ref) || row.wishlistRewatchChoice
						? row.wishlistEvidence
							? "conflict"
							: "unchanged"
						: row.wishlistShowChoice
							? "conflict"
							: "new",
				wishlistRewatchChoice:
					!!row.wishlistEvidence &&
					(current.watched.has(ref) || !!row.wishlistRewatchChoice),
				reason:
					!current.wants.has(ref) &&
					(current.watched.has(ref) || row.wishlistRewatchChoice)
						? row.wishlistEvidence
							? current.watched.has(ref)
								? "Seen in GoodWatch. Choose whether to add this title as Want to rewatch."
								: "Seen at the source. Choose whether to add this title as Want to rewatch."
							: "This title is already in your watch log."
						: row.wishlistShowChoice && !current.wants.has(ref)
							? "This file lists a season or episode. Choose Want to See the show to add the whole show."
							: null,
			}
		if (row.kind === "favorite")
			return {
				...base,
				...title,
				outcome: current.favorites.has(ref) ? "unchanged" : "new",
			}
		return { ...base, ...title, outcome: "new" }
	})
}

const itemColumns = [
	"import_id",
	"row_index",
	"user_id",
	"kind",
	"source_key",
	"payload",
	"imdb_id",
	"title",
	"year",
	"outcome",
	"reason",
	"tmdb_id",
	"media_type",
	"current_score",
	"season_number",
	"episode_number",
	"episode_tmdb_id",
	"watched_at",
	"watched_at_precision",
	"pass",
]
async function insertItems(id: string, userId: string, items: ImportItem[]) {
	for (const batch of chunks(items, 300))
		await run(
			`INSERT INTO doc.user_import_item (${itemColumns.join(",")}) VALUES ${batch.map(() => `(${marks(itemColumns.length)})`).join(",")}`,
			batch.flatMap((x): Param[] => [
				id,
				x.index,
				userId,
				x.kind,
				x.key,
				JSON.stringify(x),
				x.imdbId,
				x.title,
				x.year,
				x.outcome,
				x.reason,
				x.tmdbId,
				x.mediaType,
				x.currentScore ?? null,
				x.season ?? null,
				x.episode ?? null,
				x.episodeTmdbId ?? null,
				x.watchedAt ? new Date(x.watchedAt) : null,
				x.precision ?? null,
				x.pass ?? 1,
			]),
		)
}

export async function createPreview(
	userId: string,
	source: ImportSource,
	fileName: string,
	bytes: Uint8Array,
	wishlist?: Uint8Array,
): Promise<ImportSummary> {
	const parsed: ParsedImport = await parseImportFile(
		source,
		bytes,
		wishlist,
		fileName,
	)
	const fileHash = createHash("sha256").update(bytes)
	if (wishlist)
		fileHash.update(`\0wishlist:${wishlist.length}:`).update(wishlist)
	return createParsedPreview(userId, fileName, parsed, fileHash.digest("hex"))
}

/** Trusted server adapters can preview normalized observations without inventing an upload format. */
export async function createParsedPreview(
	userId: string,
	fileName: string,
	input: ParsedImport,
	hash = createHash("sha256").update(JSON.stringify(input)).digest("hex"),
): Promise<ImportSummary> {
	const parsed = input
	if (parsed.observations.length > IMPORT_MAX_ROWS)
		throw new ImportFileError(
			"That source produces more than 50,000 import items.",
		)
	for (const row of parsed.observations) {
		if (row.kind !== "show_status") continue
		if (row.mediaType !== "show")
			row.problem = {
				outcome: "unsupported",
				reason: "Movies have no show status.",
			}
		else if (
			row.episodeTmdbId != null ||
			row.episodeTvdbId != null ||
			row.season != null ||
			row.episode != null ||
			row.episodeGroup ||
			row.episodeName
		)
			row.problem = {
				outcome: "unsupported",
				reason:
					"A show status must describe the matched show, not an episode, season or part.",
			}
		else if (
			!isApplicableStatus(row.showStatus) &&
			row.showStatus !== "plan_to_watch"
		)
			row.problem = {
				outcome: "invalid",
				reason: "This show status has no supported value.",
			}
	}
	const source = parsed.source
	const [matched, current] = await Promise.all([
		matchCatalog(source, parsed.observations),
		currentValues(userId),
	])
	const conflictShowIds = [
		...new Set(
			parsed.observations.flatMap(
				(row) =>
					row.wishlistIdConflict?.candidates
						.filter((candidate) => candidate.mediaType === "show")
						.map((candidate) => candidate.tmdbId) ?? [],
			),
		),
	]
	const interactedShows = new Set<number>()
	for (const batch of chunks(conflictShowIds, 800)) {
		const states = await select<{ tmdb_id: number; state: string }>(
			`SELECT tmdb_id, state FROM user_watch_state WHERE user_id = ? AND media_type = 'show' AND tmdb_id IN (${marks(batch.length)})`,
			[userId, ...batch],
		)
		for (const state of states)
			if (state.state !== "not_started")
				interactedShows.add(Number(state.tmdb_id))
	}
	const popularity = new Map<string, number | null>()
	for (const type of ["movie", "show"] as const) {
		const ids = [
			...new Set(
				parsed.observations.flatMap(
					(row) =>
						row.wishlistIdConflict?.candidates
							.filter((candidate) => candidate.mediaType === type)
							.map((candidate) => candidate.tmdbId) ?? [],
				),
			),
		]
		for (const batch of chunks(ids, 800)) {
			const titles = await select<{
				tmdb_id: number
				popularity: number | null
			}>(
				`SELECT tmdb_id, popularity FROM ${type} WHERE tmdb_id IN (${marks(batch.length)})`,
				batch,
			)
			for (const title of titles)
				popularity.set(
					key(type, Number(title.tmdb_id)),
					title.popularity == null ? null : Number(title.popularity),
				)
		}
	}
	for (const row of parsed.observations) {
		const conflict = row.wishlistIdConflict
		if (!conflict) continue
		const interacted = conflict.candidates.filter((candidate) => {
			const identity = key(candidate.mediaType, candidate.tmdbId)
			return (
				current.wants.has(identity) ||
				current.watched.has(identity) ||
				current.scores.get(identity)?.score != null ||
				(candidate.mediaType === "show" &&
					interactedShows.has(candidate.tmdbId))
			)
		})
		if (interacted.length === 1) {
			conflict.suggestion = {
				mediaType: interacted[0].mediaType,
				tmdbId: interacted[0].tmdbId,
				signal: "interaction",
			}
			continue
		}
		const agrees = conflict.candidates.filter(
			(candidate) =>
				candidate.title.trim().toLocaleLowerCase() ===
					row.title.trim().toLocaleLowerCase() &&
				(row.year === null || candidate.year === row.year),
		)
		if (agrees.length === 1) {
			conflict.suggestion = {
				mediaType: agrees[0].mediaType,
				tmdbId: agrees[0].tmdbId,
				signal: "metadata",
			}
			continue
		}
		// A small difference or missing popularity is not clear evidence for a default.
		const ranked = conflict.candidates.map((candidate) => ({
			candidate,
			value:
				popularity.get(key(candidate.mediaType, candidate.tmdbId)) ??
				Number.NaN,
		}))
		if (ranked.some(({ value }) => !Number.isFinite(value) || value <= 0))
			continue
		ranked.sort((a, b) => b.value - a.value)
		if (ranked[0].value >= 2 * ranked[1].value) {
			const candidate = ranked[0].candidate
			conflict.suggestion = {
				mediaType: candidate.mediaType,
				tmdbId: candidate.tmdbId,
				signal: "popularity",
			}
		}
	}
	// Suppress duplicate effective identities before calculating any per-title library conflicts.
	if (source === "wishlist") {
		const representatives = new Map<string, ImportObservation>()
		for (const [index, row] of parsed.observations.entries()) {
			const title = matched.get(index)
			if (!title || row.kind !== "want" || row.problem) continue
			row.wishlistShowChoice =
				row.wishlistEvidence?.mediaType === "season" ||
				row.wishlistEvidence?.mediaType === "episode"
			row.wishlistRewatchChoice = row.wishlistEvidence?.sourceSeen === true
			const identity = key(title.mediaType, title.tmdbId)
			const representative = representatives.get(identity)
			if (representative) {
				representative.wishlistShowChoice ||= row.wishlistShowChoice
				representative.wishlistRewatchChoice ||= row.wishlistRewatchChoice
				row.kind = "unsupported"
				row.tmdbId = title.tmdbId
				row.mediaType = title.mediaType
				row.problem = {
					outcome: "unsupported",
					reason: "Listed twice in the file. Added once.",
				}
				matched.delete(index)
			} else representatives.set(identity, row)
		}
	}
	const items = classify(parsed.observations, matched, current)
	await classifyWishlistShows(userId, items)
	const specials = items.filter((item) => item.episodeSpecial).length
	if (specials)
		parsed.warnings.push(
			`${specials} episode row(s) map to TMDB specials. They are imported but do not count toward regular show progress.`,
		)
	const id = randomUUID()
	const watchPlans = await classifyWatchDuplicates(userId, source, id, items)
	await classifyShowStatuses(userId, source, items, watchPlans)
	const countRecord = {
		rows: items.length,
		new: 0,
		unchanged: 0,
		conflict: 0,
		unmatched: 0,
		unsupported: 0,
		invalid: 0,
	}
	for (const item of items) countRecord[item.outcome]++
	const kinds: Record<ImportKind, number> = {
		rating: 0,
		watch: 0,
		want: 0,
		favorite: 0,
		review: 0,
		show_status: 0,
	}
	for (const item of items) if (item.kind !== "unsupported") kinds[item.kind]++
	const now = new Date()

	try {
		await insertItems(id, userId, items)
		await refreshItems()
		await run(
			"INSERT INTO doc.user_import (id,user_id,source,status,file_name,counts,processed,total,added,updated,kept,failed,error,created_at,updated_at,warnings,kinds,file_hash) VALUES (?,?,?,'preview',?,?,0,?,0,0,0,0,NULL,?,?,?,?,?)",
			[
				id,
				userId,
				source,
				fileName,
				JSON.stringify(countRecord),
				items.length,
				now,
				now,
				JSON.stringify(parsed.warnings),
				JSON.stringify({
					...kinds,
					...(source === "wishlist" || source === "tvtime"
						? {
								_wishlistShowChoiceCount: items.filter(
									(item) =>
										item.outcome === "conflict" && item.wishlistShowChoice,
								).length,
								_wishlistRewatchChoiceCount: items.filter(
									(item) =>
										item.outcome === "conflict" && item.wishlistRewatchChoice,
								).length,
								_wishlistMatchCount: new Set(
									parsed.observations.flatMap((row, index) =>
										isManuallyMatchableWishlistSource(
											row.wishlistOriginal,
											row.wishlistMatchRequired,
										)
											? [wishlistSourceGroup(row.wishlistOriginal, index)]
											: [],
									),
								).size,
							}
						: {}),
				}),
				hash,
			],
		)
		await refreshImports()
	} catch (error) {
		await run("DELETE FROM doc.user_import_item WHERE import_id = ?", [
			id,
		]).catch(() => null)
		throw error
	}
	return summarize(await getImportRow(userId, id))
}

async function classifyWishlistShows(userId: string, items: ImportItem[]) {
	const wishes = items.filter(
		(item) =>
			item.kind === "want" &&
			item.wishlistEvidence &&
			item.mediaType === "show" &&
			item.tmdbId !== null &&
			["new", "conflict"].includes(item.outcome),
	)
	if (!wishes.length) return
	const { getImportStatusSnapshots } = await import("../tracking.server.ts")
	const snapshots = await getImportStatusSnapshots(userId, [
		...new Set(
			wishes.flatMap((item) => (item.tmdbId === null ? [] : [item.tmdbId])),
		),
	])
	for (const item of wishes) {
		if (item.tmdbId === null) continue
		const snapshot = snapshots.get(item.tmdbId)
		if (snapshot?.state?.state === "seen") {
			item.wishlistRewatchChoice = true
			item.outcome = "conflict"
			item.reason = item.wishlistShowChoice
				? "Seen in GoodWatch. This file lists a season or episode. Choose Want to See the show and Want to rewatch to add the whole show."
				: "Seen in GoodWatch. Choose whether to add this title as Want to rewatch."
		} else if (
			!canImportWantToSee(snapshot?.state?.state, !!snapshot?.hasWatches)
		) {
			item.outcome = "unchanged"
			item.reason = "Your GoodWatch show status is kept."
		}
	}
}

async function classifyShowStatuses(
	userId: string,
	source: ImportSource,
	items: ImportItem[],
	watchPlans: Map<string, ImportTrackingPlan>,
) {
	const byShow = new Map<number, ImportStatusItem[]>()
	for (const item of items) {
		if (
			item.kind !== "show_status" ||
			item.tmdbId === null ||
			!["new", "unchanged"].includes(item.outcome)
		)
			continue
		const group = byShow.get(item.tmdbId) ?? []
		group.push(item)
		byShow.set(item.tmdbId, group)
	}
	for (const group of byShow.values()) {
		const values = [...new Set(group.map((item) => item.showStatus))]
		if (values.length > 1) {
			const names = values
				.map((value) =>
					value ? IMPORT_SHOW_STATUS_LABELS[value].split(" → ")[0] : "Unknown",
				)
				.sort()
				.join(", ")
			for (const item of group) {
				item.outcome = "invalid"
				item.reason = `Multiple ${IMPORT_SOURCE_NAMES[source]} entries for this show have different statuses: ${names}. No show status was chosen.`
			}
			continue
		}
		const [first, ...duplicates] = group
		for (const duplicate of duplicates) {
			duplicate.outcome = "unchanged"
			duplicate.reason =
				"Another entry for this show has the same status; it is imported only once."
		}
		if (
			first.showStatus === "completed" &&
			group.some((item) => item.completionScope !== "show")
		) {
			first.outcome = "unsupported"
			first.reason =
				"Completed does not establish completion of the whole TMDB show. A part or cour never marks the whole show Seen."
		}
	}
	const statuses = [...byShow.values()]
		.map((group) => group[0])
		.filter((item) => item.outcome === "new")
	if (!statuses.length) return
	const { getImportStatusSnapshots } = await import("../tracking.server.ts")
	const snapshots = await getImportStatusSnapshots(
		userId,
		statuses.flatMap((item) => (item.tmdbId === null ? [] : [item.tmdbId])),
	)
	for (const item of statuses) {
		if (item.tmdbId === null) continue
		const snapshot = snapshots.get(item.tmdbId)
		const plan = watchPlans.get(`show:${item.tmdbId}`)
		const before = snapshot?.state ?? null
		const after = plan?.afterState ?? before
		if (item.showStatus === "plan_to_watch") {
			if (
				!canImportWantToSee(
					after?.state,
					!!snapshot?.hasWatches || !!plan?.watches.length,
				)
			) {
				item.outcome = "unchanged"
				item.reason =
					"Plan to watch becomes Want to See only for a show you have not started."
			} else item.reason = "Plan to watch becomes Want to See."
			continue
		}
		if (before?.state === "watching" && item.showStatus === "dropped")
			item.reason =
				"The file sets this Watching show to Dropped, even if you resumed it after an earlier import."
		else if (item.showStatus === "completed")
			item.reason =
				"Whole-show Completed marks aired regular episodes as watched. The show stays Watching while a season is still airing; otherwise it becomes Seen."
		item._previewStatus = before
			? { _seq_no: before._seq_no, _primary_term: before._primary_term }
			: null
		if (
			after &&
			(PROTECTED_STATES.includes(after.state) ||
				(after.state === item.showStatus && !plan?.watches.length))
		) {
			item.outcome = "unchanged"
			item.reason = "Your GoodWatch show status is kept."
		}
	}
}
