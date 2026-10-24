import { importedScoreTarget } from "../../domain/episode-scores.ts"
// An imported episode score marks its episode watched (#759 follow-up): when the import wrote the score and no pass
// has a watch of the episode, the import records one undated watch of it. Season and part scores mark nothing.
//
// The watch is an imported watch (origin `import`, the import's id), made through the same per-show tracking plan as
// imported history (tracking.server.ts, prepareImportTrackingPlan): it sets a show's status only where an import
// may, it doesn't count as the member's activity, and the import's Undo takes back exactly the watches it added and
// puts back the Want to See or Not interested they cleared.
//
// The plan is journaled in the payload of the show's first scored row before any watch is written, so a resumed
// import finishes it and Undo finds it. Both the native imports (apply.server.ts) and the IMDb ratings import
// (imdb-import/apply.server.ts) call this after their scores are written; a native import's own watch rows come
// first, so an episode the file also lists as watched isn't marked twice.
import type { StoredUndoOutcome } from "../../domain/import-result.ts"
import type { ImportItem, ImportSource } from "../../domain/imports.ts"
import { run } from "./store.server.ts"
import type { ImportTrackingPlan } from "./tracking.server.ts"

/** An episode_rating row of an import, with its payload, and whether this import wrote its score. */
export type ScoredRow = ImportItem & {
	payload: Record<string, unknown>
	applied: boolean
}

/** What a show's first scored row carries: the plan, whether it was applied, and what Undo did with it. */
interface ScoreWatchJournal {
	plan: ImportTrackingPlan
	applied?: boolean
	undo?: StoredUndoOutcome
}

type Tracking = typeof import("./tracking.server.ts")
const liveTracking = () => import("./tracking.server.ts")
let tracking: () => Promise<
	Pick<
		Tracking,
		| "prepareImportTrackingPlan"
		| "applyImportTrackingPlan"
		| "undoImportTrackingPlan"
		| "restoreImportTrackingIntentions"
	>
> = liveTracking
/** Test-only tracking boundary. Passing no value restores the live writer. */
export const setScoreWatchTrackingForTest = (
	replacement?: Awaited<ReturnType<typeof tracking>>,
) => {
	tracking = replacement ? async () => replacement : liveTracking
}

const journalOf = (row: ScoredRow) =>
	row.payload.scoreWatch as ScoreWatchJournal | undefined

function requiredJournal(row: ScoredRow): ScoreWatchJournal {
	const journal = journalOf(row)
	if (!journal) throw new Error("The episode-score watch journal is missing.")
	return journal
}

async function persist(
	importId: string,
	row: ScoredRow,
	journal: ScoreWatchJournal,
) {
	const payload = { ...row.payload, scoreWatch: journal }
	await run(
		"UPDATE doc.user_import_item SET payload = ? WHERE import_id = ? AND row_index = ?",
		[JSON.stringify(payload), importId, row.index],
	)
	row.payload = payload
}

/** The watch item a scored episode stands for: the same key for every source, so no two imports add it twice. */
function watchItem(row: ScoredRow): ImportItem | null {
	const target = importedScoreTarget(row)
	if (target?.scope !== "episode" || row.tmdbId === null) return null
	return {
		...row,
		key: `episode-score:${row.tmdbId}:${target.episodeTmdbId}`,
		kind: "watch",
		mediaType: "show",
		episodeTmdbId: target.episodeTmdbId,
		season: target.season,
		episode: target.episode,
		precision: "unknown",
		watchedAt: null,
		pass: undefined,
	}
}

/**
 * Records the watches of the episodes this import scored, show by show. A plan journaled by an earlier, interrupted
 * run is applied first; scored episodes no plan covers yet get a new one.
 */
export async function markImportedEpisodesWatched(
	userId: string,
	importId: string,
	source: ImportSource | "imdb",
	rows: ScoredRow[],
): Promise<void> {
	const shows = new Map<number, ScoredRow[]>()
	for (const row of rows)
		if (row.tmdbId !== null && importedScoreTarget(row)?.scope === "episode")
			shows.set(row.tmdbId, [...(shows.get(row.tmdbId) ?? []), row])
	const writer = await tracking()
	const apply = async (row: ScoredRow, journal: ScoreWatchJournal) => {
		await writer.applyImportTrackingPlan(userId, journal.plan, async (plan) => {
			// A state retry saw another write: the journal keeps the transition that lands.
			await persist(importId, row, { ...journal, plan })
		})
		await persist(importId, row, { ...requiredJournal(row), applied: true })
	}
	for (const [showId, showRows] of shows) {
		const carriers = showRows.filter((row) => journalOf(row))
		for (const row of carriers) {
			const journal = requiredJournal(row)
			if (!journal.applied) await apply(row, journal)
		}
		const covered = new Set(
			carriers.flatMap((row) => {
				const { plan } = requiredJournal(row)
				return [...plan.addedKeys, ...plan.keptKeys]
			}),
		)
		const wanted = showRows.flatMap((row) => {
			const item = row.applied ? watchItem(row) : null
			return item && !covered.has(item.key) ? [{ row, item }] : []
		})
		if (!wanted.length) continue
		const plan = await writer.prepareImportTrackingPlan({
			userId,
			importId,
			source,
			tmdbId: showId,
			mediaType: "show",
			items: wanted.map(({ item }) => item),
			watchDates: "unknown",
			now: Date.now(),
			onlyUnwatched: true,
			restoreIntentions: true,
		})
		// Every one of them is watched already: nothing to record, and nothing for Undo.
		if (!plan.watches.length) continue
		const carrier = wanted[0].row
		await persist(importId, carrier, { plan })
		await apply(carrier, { plan })
	}
}

/**
 * Undo: takes back the watches of the import's episode scores and the status they set, newest plan first, and puts
 * back the Want to See and Not interested they cleared where nothing changed since. A watch a later import or the
 * member added stays. Plans an interrupted Undo already settled keep their outcome.
 */
export async function undoImportedEpisodeWatches(
	userId: string,
	importId: string,
	rows: ScoredRow[],
	/** Native multi-pass imports interleave these receipts with their tracking plans. */
	after?: number,
): Promise<void> {
	const writer = await tracking()
	const carriers = rows
		.filter((row) => {
			const journal = journalOf(row)
			return (
				journal?.applied &&
				(after === undefined || journal.plan.now >= after) &&
				(!journal.undo || journal.undo === "reverting")
			)
		})
		.sort((a, b) =>
			after === undefined
				? b.index - a.index
				: requiredJournal(b).plan.now - requiredJournal(a).plan.now ||
					b.index - a.index,
		)
	for (const row of carriers) {
		const journal = requiredJournal(row)
		const resumed = journal.undo === "reverting"
		await persist(importId, row, { ...journal, undo: "reverting" })
		const outcome = await writer.undoImportTrackingPlan(
			userId,
			journal.plan,
			resumed,
		)
		// The outcome is journaled once the lists are back too: an Undo that stops before then is resumed, and putting
		// them back again keeps what is already there.
		if (outcome === "reverted")
			await writer.restoreImportTrackingIntentions(
				userId,
				requiredJournal(row).plan,
				async (plan) => {
					await persist(importId, row, { ...requiredJournal(row), plan })
				},
			)
		await persist(importId, row, { ...requiredJournal(row), undo: outcome })
	}
}
