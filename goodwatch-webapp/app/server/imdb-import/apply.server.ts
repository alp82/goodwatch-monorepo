import type {
	ImdbConflictChoice,
	ImdbImportCounts,
	ImdbImportSummary,
} from "~/domain/imdb-import"
// Confirming an import writes its ratings to user_score; undo takes them back.
//
// Crate has no transactions, and a write that filters on anything but the whole primary key only sees rows after a
// refresh. So the apply works in batches, each one: refresh, write, refresh, read the rows back, then record per
// item what happened. Three rules keep it safe to interrupt and to run again:
// - A new rating is inserted with ON CONFLICT DO NOTHING, and an existing one is updated only while it still holds
//   the score the preview saw. A rating the member set since the preview is never overwritten.
// - Every row the import writes gets the import's confirm time as updated_at. The read-back recognises the import's
//   own writes by it, also after a restart or a write that timed out and landed later.
// - While it runs, the apply sets the import's updated_at every few seconds. The other webapp instance reads from it
//   that the import is alive, and offers a resume only once it has been silent for STALL_MS.
// - The written review, Want to See, skipped and favorites are never touched. That is why this doesn't go through
//   updateScores, which replaces the review and takes a rated movie off the Wishlist.
// - A rated movie is Seen through the watch its score owns (docs/implementation/tracking/data-model.md, C2). After
//   each batch of scores, and after an undo took scores back, the batch's movies are settled by the movie rule:
//   the score's watch is written where a movie now has a score and no watch, and removed where the score went.
//   A watch the member logged is never touched. Settling again writes nothing, so it runs before the items are
//   marked and a run that broke off settles them again.
// - Episode rows (#759) write the member's episode score to user_episode_score, one row at a time through the
//   shared import journal (imports/episode-score-apply.server.ts), after the titles. They never touch user_score, the
//   movie rule, Taste or the fingerprint count. An episode whose score the import wrote is then marked watched, with
//   one imported, undated watch, when no pass has a watch of it; Undo takes back only those watches
//   (imports/episode-score-watches.server.ts).
import type { StoredUndoOutcome } from "~/domain/import-result"
import type { ImportItem } from "~/domain/imports"
import { resetOnboardingMediaCache } from "~/server/onboarding-media.server"
import { markTasteChanged } from "~/server/taste/index.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import { settleMovies } from "~/server/tracking.server"
import { resetUserDataCache } from "~/server/userData.server"
import {
	captureProductEvent,
	eventUuid,
	withProductContext,
} from "~/telemetry/product-analytics.server"
import { CrateTimeoutError } from "~/utils/crate"
import { titleKey } from "~/utils/title-key"
import {
	applyImportedEpisodeScore,
	undoImportedEpisodeScore,
} from "../imports/episode-score-apply.server.ts"
import {
	markImportedEpisodesWatched,
	undoImportedEpisodeWatches,
} from "../imports/episode-score-watches.server.ts"
import { titleRef } from "./classify.server"
import { ImdbImportError, type ImportMediaType, MAX_ROWS } from "./file.server"
import {
	HEARTBEAT_MS,
	type Param,
	activeRuns,
	chunks,
	claimImport,
	getImportRow,
	isStalled,
	listImportRows,
	marks,
	questionOptions,
	questionStates,
	refreshImports,
	refreshItems,
	run,
	select,
	summarize,
	toMs,
} from "./store.server"

const APPLY_BATCH = 500
const UNDO_BATCH = 500

const refreshScores = () => run("REFRESH TABLE user_score")

/** Once per apply or undo, not per row. None of these throw away the member's data, so a failure is only logged. */
export async function ratingsChanged(userId: string) {
	const results = await Promise.allSettled([
		resetUserDataCache({ user_id: userId }),
		markTasteChanged(userId),
		resetOnboardingMediaCache({ userId, searchTerm: "" }),
	])
	for (const result of results)
		if (result.status === "rejected")
			console.error("IMDb import: clearing a cache failed:", result.reason)
}

/** The movie rule for the movies among an import's titles, after their scores were written or taken back. */
export const settleImportedMovies = (
	userId: string,
	items: readonly { tmdb_id: number; media_type: ImportMediaType }[],
) =>
	settleMovies(
		userId,
		items
			.filter((item) => item.media_type === "movie")
			.map((item) => Number(item.tmdb_id)),
	)

/** A row the import still has to write. */
interface Pending {
	apply_state?: string | null
	payload?: string | null
	outcome?: string
	row_index: number
	tmdb_id: number
	media_type: ImportMediaType
	imdb_score: number
	/** The member's rating when the preview was made: null means insert, a score means update from it. */
	current_score: number | null
}
/** An episode row the import still has to write. Its payload holds the target and the score the preview saw. */
interface PendingEpisode {
	apply_state?: string | null
	outcome?: string
	row_index: number
	tmdb_id: number
	imdb_score: number
	payload: string | null
}
type ApplyState = "added" | "updated" | "kept" | "failed"

/** The journal item the shared episode score writer reads, from an episode row of this import. */
const episodeItem = (row: {
	row_index: number
	tmdb_id: number
	imdb_score?: number
	payload: string | null
}) => {
	const payload = JSON.parse(row.payload ?? "{}") as Record<string, unknown>
	return {
		...(payload as Partial<ImportItem>),
		key: `imdb:episode:${row.row_index}`,
		kind: "episode_rating" as const,
		mediaType: "show" as const,
		title: "",
		year: null,
		imdbId: null,
		outcome: "new" as const,
		reason: null,
		index: Number(row.row_index),
		tmdbId: Number(row.tmdb_id),
		...(row.imdb_score === undefined ? {} : { score: Number(row.imdb_score) }),
		payload,
	}
}

/**
 * Every episode row of the import with its payload, and whether the import wrote its score. None without a read for
 * a file the preview matched no episode in, so such a file sends what it did before #759.
 */
async function scoredEpisodeRows(importId: string, counts: string) {
	if (!((JSON.parse(counts) as ImdbImportCounts).episodes ?? 0)) return []
	const rows = await select<{
		row_index: number
		tmdb_id: number
		payload: string | null
		apply_state: string | null
	}>(
		`SELECT row_index, tmdb_id, payload, apply_state FROM doc.user_import_item
		 WHERE import_id = ? AND kind = 'episode_rating' AND tmdb_id IS NOT NULL LIMIT ${MAX_ROWS}`,
		[importId],
	)
	return rows.map((row) => ({
		...episodeItem(row),
		applied: row.apply_state === "added" || row.apply_state === "updated",
	}))
}

/** Writes one episode score; a row that throws is tried again on resume. */
async function applyEpisode(
	userId: string,
	importId: string,
	row: PendingEpisode,
): Promise<ApplyState> {
	try {
		return await applyImportedEpisodeScore(userId, importId, episodeItem(row))
	} catch (error) {
		console.error(`IMDb import ${importId}: an episode score failed:`, error)
		return "failed"
	}
}
type Tally = Record<ApplyState, number>

function groupBy<T>(list: T[], key: (item: T) => string): T[][] {
	const groups = new Map<string, T[]>()
	for (const item of list)
		groups.set(key(item), [...(groups.get(key(item)) ?? []), item])
	return [...groups.values()]
}

/** A write that timed out may still land, now or later. What became of it is read back afterwards. */
const runUnlessTimeout = (sql: string, params: Param[]) =>
	run(sql, params).catch((error) => {
		if (!(error instanceof CrateTimeoutError)) throw error
	})

async function writeBatch(userId: string, stamp: Date, batch: Pending[]) {
	const inserts = batch.filter((item) => item.current_score === null)
	if (inserts.length)
		await runUnlessTimeout(
			`INSERT INTO user_score (user_id, tmdb_id, media_type, score, created_at, updated_at)
			 VALUES ${inserts.map(() => "(?, ?, ?, ?, ?, ?)").join(", ")}
			 ON CONFLICT (user_id, tmdb_id, media_type) DO NOTHING`,
			inserts.flatMap((item): Param[] => [
				userId,
				Number(item.tmdb_id),
				item.media_type,
				Number(item.imdb_score),
				stamp,
				stamp,
			]),
		)
	const updates = batch.filter((item) => item.current_score !== null)
	for (const group of groupBy(
		updates,
		(item) => `${item.media_type}:${item.imdb_score}:${item.current_score}`,
	))
		await runUnlessTimeout(
			`UPDATE user_score SET score = ?, updated_at = ?
			 WHERE user_id = ? AND media_type = ? AND score = ? AND tmdb_id IN (${marks(group.length)})`,
			[
				Number(group[0].imdb_score),
				stamp,
				userId,
				group[0].media_type,
				Number(group[0].current_score),
				...group.map((item) => Number(item.tmdb_id)),
			],
		)
}

/** The member's ratings for the batch's titles as they are now, and whether this import wrote them. */
async function readBack(userId: string, stamp: Date, batch: Pending[]) {
	const now = new Map<string, { score: number | null; ours: boolean }>()
	for (const group of groupBy(batch, (item) => item.media_type)) {
		const rows = await select<{
			tmdb_id: number
			score: number | null
			updated_at: number | string | Date | null
		}>(
			`SELECT tmdb_id, score, updated_at FROM user_score
			 WHERE user_id = ? AND media_type = ? AND tmdb_id IN (${marks(group.length)})`,
			[
				userId,
				group[0].media_type,
				...group.map((item) => Number(item.tmdb_id)),
			],
		)
		for (const row of rows)
			now.set(titleRef(group[0].media_type, Number(row.tmdb_id)), {
				score: row.score === null ? null : Number(row.score),
				ours:
					row.updated_at !== null && toMs(row.updated_at) === stamp.getTime(),
			})
	}
	return now
}

/** Writes one batch and reports what became of each row. A row that didn't land is tried once more. */
async function applyBatch(userId: string, stamp: Date, batch: Pending[]) {
	const states = new Map<number, ApplyState>()
	let todo = batch
	for (let attempt = 0; attempt < 2 && todo.length; attempt++) {
		await refreshScores()
		await writeBatch(userId, stamp, todo)
		await refreshScores()
		const now = await readBack(userId, stamp, todo)
		for (const item of todo) {
			const row = now.get(titleRef(item.media_type, Number(item.tmdb_id)))
			const insert = item.current_score === null
			let state: ApplyState
			if (row?.ours && row.score === Number(item.imdb_score))
				state = insert ? "added" : "updated"
			// No row where one was inserted, or the old score where one was updated: the write didn't land.
			else if (insert ? !row : row?.score === Number(item.current_score))
				state = "failed"
			// Anything else is the member's doing since the preview: they rated it, changed it or removed it.
			else state = "kept"
			states.set(item.row_index, state)
		}
		todo = todo.filter((item) => states.get(item.row_index) === "failed")
	}
	for (const item of batch)
		if (["added", "updated"].includes(states.get(item.row_index) ?? ""))
			captureProductEvent(
				userId,
				"rating saved",
				{
					tmdb_id: Number(item.tmdb_id),
					media_type: item.media_type,
					score: Number(item.imdb_score),
					origin: "import",
					import_source: "imdb",
				},
				{
					uuid: eventUuid(
						`import-rating:${userId}:${item.media_type}:${item.tmdb_id}:${stamp.toISOString()}`,
					),
				},
			)
	return states
}

async function recordStates(importId: string, states: Map<number, ApplyState>) {
	const at = new Date()
	for (const group of groupBy([...states], ([, state]) => state)) {
		const state = group[0][1]
		const written = state === "added" || state === "updated"
		await run(
			`UPDATE doc.user_import_item
			 SET apply_state = ?${written ? ", prior_score = current_score, applied_score = imdb_score, applied_at = ?" : ""}
			 WHERE import_id = ? AND row_index IN (${marks(group.length)})`,
			[
				state,
				...(written ? [at] : []),
				importId,
				...group.map(([rowIndex]) => rowIndex),
			],
		)
	}
}

async function readTally(importId: string): Promise<Tally> {
	const rows = await select<{ apply_state: string; n: number }>(
		`SELECT apply_state, count(*) AS n FROM doc.user_import_item
		 WHERE import_id = ? AND apply_state IS NOT NULL GROUP BY apply_state`,
		[importId],
	)
	const tally: Tally = { added: 0, updated: 0, kept: 0, failed: 0 }
	for (const row of rows)
		if (row.apply_state in tally)
			tally[row.apply_state as ApplyState] = Number(row.n)
	return tally
}

/** How many of the titles this import wrote have no fingerprint, so they don't count toward Taste yet. */
async function countWithoutFingerprint(
	importId: string,
): Promise<number | null> {
	const snapshot = getTitleSnapshot()
	if (!snapshot) return null
	const rows = await select<{ tmdb_id: number; media_type: ImportMediaType }>(
		`SELECT tmdb_id, media_type FROM doc.user_import_item
		 WHERE import_id = ? AND apply_state IN ('added', 'updated') AND kind IS NULL LIMIT ${MAX_ROWS}`,
		[importId],
	)
	return rows.filter(
		(row) =>
			!snapshot.fingerprint(titleKey(row.media_type, Number(row.tmdb_id))),
	).length
}

/**
 * Reports that the import is alive until the returned function is called, which also waits for a report on its way.
 * The write goes by the primary key alone, so every read of the import by its key sees it at once.
 */
function startHeartbeat(importId: string) {
	let beat: Promise<unknown> | null = null
	const timer = setInterval(() => {
		// A report that Crate hasn't answered yet is not sent again.
		beat ??= run(
			"UPDATE doc.user_import SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
			[importId],
		)
			.catch((error) =>
				console.error(
					`IMDb import ${importId}: reporting that it's alive failed:`,
					error,
				),
			)
			.finally(() => {
				beat = null
			})
	}, HEARTBEAT_MS)
	// The import doesn't keep a process alive that is shutting down.
	timer.unref()
	return async () => {
		clearInterval(timer)
		await beat
	}
}

/** The background task. Picks up whatever the import hasn't settled yet, so starting and resuming are the same. */
async function applyStored(userId: string, importId: string) {
	let wrote = false
	// Only title ratings change Taste and the caches that follow it; episode scores don't.
	let wroteTitles = false
	let stopHeartbeat = startHeartbeat(importId)
	try {
		while (true) {
			const row = await getImportRow(userId, importId)
			if (!row.confirmed_at || !row.conflict_choice)
				throw new Error("The import was never confirmed")
			const stamp = new Date(row.confirmed_at)
			const useImdb = row.conflict_choice === "imdb"

			await refreshItems()
			if (questionOptions(row).ask) await holdQuestions(userId, importId)
			else if (!useImdb) {
				await run(
					"UPDATE doc.user_import_item SET apply_state = 'kept' WHERE import_id = ? AND outcome = 'conflict' AND apply_state IS NULL",
					[importId],
				)
				await refreshItems()
			}
			const pending = (
				await select<Pending>(
					`SELECT row_index, tmdb_id, media_type, imdb_score, current_score${questionOptions(row).ask ? ", apply_state, payload, outcome" : ""} FROM doc.user_import_item
			 WHERE import_id = ? AND outcome IN ('new', 'update'${useImdb || questionOptions(row).ask ? ", 'conflict'" : ""})
			   AND (apply_state IS NULL OR apply_state = 'failed'${questionOptions(row).ask ? " OR apply_state = 'approved:conflict'" : ""}) AND kind IS NULL
			 ORDER BY row_index LIMIT ${MAX_ROWS}`,
					[importId],
				)
			).filter((item) =>
				eligible(item, questionOptions(row).ask === true, useImdb),
			)
			const episodes = (
				await select<PendingEpisode>(
					`SELECT row_index, tmdb_id, imdb_score, payload${questionOptions(row).ask ? ", apply_state, outcome" : ""} FROM doc.user_import_item
			 WHERE import_id = ? AND kind = 'episode_rating' AND outcome IN ('new', 'update'${useImdb || questionOptions(row).ask ? ", 'conflict'" : ""})
			   AND (apply_state IS NULL OR apply_state = 'failed'${questionOptions(row).ask ? " OR apply_state = 'approved:conflict'" : ""})
			 ORDER BY row_index LIMIT ${MAX_ROWS}`,
					[importId],
				)
			).filter((item) =>
				eligible(item, questionOptions(row).ask === true, useImdb),
			)
			// Rows that failed last time are tried again, so they start uncounted.
			const tally = { ...(await readTally(importId)), failed: 0 }
			const total = questionOptions(row).ask
				? await questionTotal(importId, row.counts)
				: Number(row.total)
			let processed = Math.max(0, total - pending.length - episodes.length)
			const report = async () => {
				if (questionOptions(row).ask)
					return recountQuestions(importId, row.counts)
				return run(
					"UPDATE doc.user_import SET processed = ?, added = ?, updated = ?, kept = ?, failed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
					[
						processed,
						tally.added,
						tally.updated,
						tally.kept,
						tally.failed,
						importId,
					],
				)
			}
			await report()

			for (const batch of chunks(pending, APPLY_BATCH)) {
				wrote = true
				wroteTitles = true
				const states = await applyBatch(userId, stamp, batch)
				await settleImportedMovies(userId, batch)
				await saveConsent(importId, batch, states)
				await recordStates(importId, states)
				for (const state of states.values()) tally[state]++
				processed += batch.length
				await report()
			}
			for (const batch of chunks(episodes, APPLY_BATCH)) {
				wrote = true
				const states = new Map<number, ApplyState>()
				for (const episode of batch)
					states.set(
						Number(episode.row_index),
						await applyEpisode(userId, importId, episode),
					)
				await saveConsent(importId, batch, states)
				await recordStates(importId, states)
				for (const state of states.values()) tally[state]++
				processed += batch.length
				await report()
			}
			// An episode the import scored is marked watched when no pass has a watch of it (#759 follow-up).
			await refreshItems()
			const scored = await scoredEpisodeRows(importId, row.counts)
			if (scored.length)
				await markImportedEpisodesWatched(userId, importId, "imdb", scored)

			await refreshItems()
			const withoutFingerprint = await countWithoutFingerprint(importId).catch(
				(error) => {
					console.error(
						"IMDb import: counting titles without a fingerprint failed:",
						error,
					)
					return null
				},
			)
			// From here on updated_at belongs to the result: a late heartbeat would change it under a resume.
			await stopHeartbeat()
			const version = await getImportRow(userId, importId)
			await refreshItems()
			if (questionOptions(row).ask) {
				const pending = await select<{ row_index: number }>(
					"SELECT row_index FROM doc.user_import_item WHERE import_id = ? AND (apply_state IS NULL AND outcome IN ('new', 'update', 'conflict') OR apply_state = 'approved:conflict') LIMIT 1",
					[importId],
				)
				if (pending.length) {
					stopHeartbeat = startHeartbeat(importId)
					continue
				}
			}
			const final = await readTally(importId)
			const now = new Date()
			const finished = await claimImport(
				version,
				`status = ?, error = ?, ${questionOptions(row).ask ? "total = ?, " : ""}processed = ?, added = ?, updated = ?, kept = ?, failed = ?, without_fingerprint = ?, finished_at = ?, updated_at = ?`,
				[
					final.failed ? "failed" : "done",
					final.failed
						? `${final.failed} ${final.failed === 1 ? "rating" : "ratings"} couldn't be saved. Try again to finish the import.`
						: null,
					...(questionOptions(row).ask
						? [await questionTotal(importId, row.counts)]
						: []),
					questionOptions(row).ask ? await questionProcessed(importId) : total,
					final.added,
					final.updated,
					final.kept,
					final.failed,
					withoutFingerprint,
					questionOptions(row).ask && version.finished_at !== null
						? new Date(version.finished_at)
						: final.failed
							? null
							: now,
					now,
				],
			)
			if (finished) break
			stopHeartbeat = startHeartbeat(importId)
		}
	} catch (error) {
		console.error(`IMDb import ${importId} stopped:`, error)
		await stopHeartbeat()
		await run(
			"UPDATE doc.user_import SET status = 'failed', error = ?, updated_at = ? WHERE id = ?",
			[
				"The import stopped before it finished. Nothing is lost: try again to finish it.",
				new Date(),
				importId,
			],
		).catch((failure) =>
			console.error(
				`IMDb import ${importId}: recording the failure failed:`,
				failure,
			),
		)
	} finally {
		await refreshImports().catch(() => null)
		if (wrote && wroteTitles) await ratingsChanged(userId)
	}
}

const KEEP_REASON = "You chose to keep what GoodWatch has."

function eligible(
	row: {
		outcome?: string
		apply_state?: string | null
		payload?: string | null
	},
	ask: boolean,
	useImdb: boolean,
) {
	if (!ask || row.outcome !== "conflict") return true
	return (
		row.apply_state === "approved:conflict" ||
		(row.apply_state === "failed" &&
			(useImdb || JSON.parse(row.payload ?? "{}")._answer?.conflict === "imdb"))
	)
}

/** Preserve row consent only when a failed write replaces its approval, as in general imports. */
export async function saveConsent(
	id: string,
	rows: {
		row_index: number
		apply_state?: string | null
		payload?: string | null
	}[],
	states: Map<number, ApplyState>,
) {
	const failed = rows.filter(
		(row) =>
			row.apply_state === "approved:conflict" &&
			states.get(row.row_index) === "failed",
	)
	if (!failed.length) return
	await run(
		`UPDATE doc.user_import_item SET payload = CASE row_index ${failed.map(() => "WHEN ? THEN ?").join(" ")} ELSE payload END WHERE import_id = ? AND row_index IN (${marks(failed.length)})`,
		[
			...failed.flatMap((row) => [
				row.row_index,
				JSON.stringify({
					...JSON.parse(row.payload ?? "{}"),
					_answer: { conflict: "imdb" },
				}),
			]),
			id,
			...failed.map((row) => row.row_index),
		],
	)
}

export async function transitionConflict(
	id: string,
	answer: "keep" | "imdb",
	indexes?: number[],
) {
	const result = await run(
		`UPDATE doc.user_import_item SET apply_state = ?, applied_at = CURRENT_TIMESTAMP${answer === "keep" ? ", reason = ?" : ""} WHERE import_id = ? AND apply_state = 'waiting:conflict'${indexes ? ` AND row_index IN (${marks(indexes.length)})` : ""}`,
		[
			answer === "keep" ? "kept" : "approved:conflict",
			...(answer === "keep" ? [KEEP_REASON] : []),
			id,
			...(indexes ?? []),
		],
	)
	return result.rowcount ?? 0
}

/** Repair missed holds and whole answers on each pass without moving already-settled rows. */
export async function holdQuestions(userId: string, id: string) {
	const row = await getImportRow(userId, id)
	const options = questionOptions(row)
	if (!options.ask) return
	await refreshItems()
	await run(
		"UPDATE doc.user_import_item SET apply_state = 'waiting:conflict' WHERE import_id = ? AND outcome = 'conflict' AND apply_state IS NULL",
		[id],
	)
	await refreshItems()
	// Re-read: a whole answer may have raced the hold.
	const answer = questionOptions(await getImportRow(userId, id)).answer
	if (answer) {
		await transitionConflict(id, answer)
		await refreshItems()
	}
	await recountQuestions(id, row.counts)
}

export async function questionProcessed(id: string) {
	return (await questionStates(id)).reduce(
		(n, row) =>
			n +
			(row.apply_state.startsWith("waiting:") ||
			["added", "updated", "kept", "failed"].includes(row.apply_state)
				? Number(row.n)
				: 0),
		0,
	)
}

/** Every held or settled conflict counts in both progress measures. */
export async function questionTotal(id: string, counts: string) {
	const rows = await select<{ n: number }>(
		"SELECT count(*) AS n FROM doc.user_import_item WHERE import_id = ? AND outcome = 'conflict' AND apply_state IN ('waiting:conflict', 'approved:conflict', 'added', 'updated', 'kept', 'failed')",
		[id],
	)
	const parsed = JSON.parse(counts) as ImdbImportCounts
	return parsed.new + parsed.update + Number(rows[0]?.n ?? 0)
}

export async function recountQuestions(
	id: string,
	counts: string,
	{ heartbeat = true } = {},
) {
	await refreshItems()
	const tally = await readTally(id)
	await run(
		`UPDATE doc.user_import SET total = ?, processed = ?, added = ?, updated = ?, kept = ?, failed = ?${heartbeat ? ", updated_at = CURRENT_TIMESTAMP" : ""} WHERE id = ?`,
		[
			await questionTotal(id, counts),
			await questionProcessed(id),
			tally.added,
			tally.updated,
			tally.kept,
			tally.failed,
			id,
		],
	)
}

async function cancelQuestions(id: string) {
	await refreshItems()
	await run(
		"UPDATE doc.user_import_item SET apply_state = 'kept' WHERE import_id = ? AND apply_state IN ('waiting:conflict', 'approved:conflict')",
		[id],
	)
	await refreshItems()
}

async function checkRunningLock(userId: string, id: string) {
	await refreshImports()
	if (
		(await listImportRows(userId, "running")).some(
			(other) => other.id !== id && !isStalled(other),
		)
	)
		throw new ImdbImportError(
			409,
			"Another import is still running. Wait for it to finish, then try again.",
		)
}

export async function decideImport(
	userId: string,
	id: string,
	answer: "keep" | "imdb",
	rows?: number[],
) {
	if (
		!["keep", "imdb"].includes(answer) ||
		(rows &&
			(!rows.length ||
				rows.length > 500 ||
				rows.some((index) => !Number.isSafeInteger(index) || index < 0)))
	)
		throw new ImdbImportError(400, "Choose a valid answer and import rows.")
	let row = await getImportRow(userId, id)
	const check = () => {
		if (
			!["running", "done", "failed"].includes(row.status) ||
			questionOptions(row).direction === "undo" ||
			undoing.has(id)
		)
			throw new ImdbImportError(409, "This import cannot accept answers now.")
		if (!questionOptions(row).ask)
			throw new ImdbImportError(
				400,
				"This question was not asked for this import.",
			)
	}
	check()
	await checkRunningLock(userId, id)
	if (!rows) {
		let saved = false
		for (let attempt = 0; attempt < 3; attempt++) {
			row = await getImportRow(userId, id)
			check()
			if (
				await claimImport(
					row, // Keep the heartbeat timestamp until the fresh restart check below.
					"options = ?, conflict_choice = ?",
					[JSON.stringify({ ...questionOptions(row), answer }), answer],
				)
			) {
				saved = true
				break
			}
		}
		if (!saved)
			throw new ImdbImportError(
				409,
				"The import changed. Try your answer again.",
			)
	}
	const indexes = rows ? [...new Set(rows)] : undefined
	await refreshItems()
	const decided = await transitionConflict(id, answer, indexes)
	await refreshItems()
	// Fence a finisher that saw no pending items before this decision. Preserve the
	// heartbeat so the fresh read below can still recognize a stalled worker.
	await recountQuestions(id, row.counts, { heartbeat: false })
	row = await getImportRow(userId, id)
	check()
	if (
		row.status === "done" ||
		row.status === "failed" ||
		(isStalled(row) && !activeRuns.has(id))
	) {
		const approved = (await questionStates(id)).some(
			(s) => s.apply_state === "approved:conflict" && Number(s.n) > 0,
		)
		if (approved) {
			// Re-read before claiming: another pod may already have restarted this import.
			row = await getImportRow(userId, id)
			check()
			if (
				(row.status !== "running" || (isStalled(row) && !activeRuns.has(id))) &&
				(await claimImport(
					row,
					"status = 'running', total = ?, error = NULL, updated_at = CURRENT_TIMESTAMP",
					[await questionTotal(id, row.counts)],
				))
			)
				startApply(userId, id)
		}
	}
	await recountQuestions(id, row.counts, { heartbeat: false })
	captureProductEvent(
		userId,
		"import question answered",
		{
			import_id: id,
			import_source: "imdb",
			question: "conflict",
			answer,
			decided,
		},
		{
			uuid: eventUuid(
				`import-question:${userId}:${id}:conflict:${answer}:${indexes ? indexes.sort((a, b) => a - b).join(",") : "all"}`,
			),
		},
	)
	await refreshImports()
	return { import: summarize(await getImportRow(userId, id)), decided }
}

const runTokens = new Map<string, object>()
function startApply(userId: string, importId: string) {
	const token = {}
	runTokens.set(importId, token)
	activeRuns.add(importId)
	// Off the request path: the client polls the import for progress. `apply` never rejects.
	void apply(userId, importId).finally(() => {
		if (runTokens.get(importId) === token) {
			runTokens.delete(importId)
			activeRuns.delete(importId)
		}
	})
}

/**
 * Starts the import, or resumes one that failed or stalled, and returns at once with status `running`.
 * A resumed import keeps the conflict choice it was started with, because part of it is already written.
 */
export async function confirmImport(
	userId: string,
	importId: string,
	choice: ImdbConflictChoice,
): Promise<ImdbImportSummary> {
	// The look for another running import below filters on more than the key, so it needs the latest state searchable.
	await refreshImports()
	const row = await getImportRow(userId, importId)
	if (questionOptions(row).direction === "undo")
		throw new ImdbImportError(
			409,
			"This import is being undone. Try undo again to resume it.",
		)
	if (row.status === "done")
		throw new ImdbImportError(409, "This import is already finished.")
	if (row.status === "undone")
		throw new ImdbImportError(
			409,
			"This import was undone. Upload the file again to import it.",
		)
	if (row.status === "running" && !isStalled(row)) return summarize(row)

	// Each claim holds only for the row as it was read above: a preview that is still a preview, or a failed or stalled
	// import that hasn't reported since. Only one of several simultaneous requests gets it, in either process.
	let claimed: boolean
	if (row.status === "preview") {
		const running = await listImportRows(userId, "running")
		if (running.some((other) => !isStalled(other)))
			throw new ImdbImportError(
				409,
				"Another import is still running. Wait for it to finish, then try again.",
			)
		const counts = JSON.parse(row.counts) as ImdbImportCounts
		const total =
			counts.new + counts.update + (choice === "imdb" ? counts.conflict : 0)
		claimed = await claimImport(
			row,
			`status = 'running', conflict_choice = ?, total = ?, confirmed_at = ?, updated_at = CURRENT_TIMESTAMP${choice === "ask" ? ", options = ?" : ""}`,
			[
				choice,
				total,
				new Date(),
				...(choice === "ask" ? [JSON.stringify({ ask: true })] : []),
			],
		)
	} else {
		claimed = await claimImport(
			row,
			`status = 'running', error = NULL, ${questionOptions(row).ask ? "" : "finished_at = NULL, "}updated_at = CURRENT_TIMESTAMP`,
			[],
		)
	}
	if (claimed) {
		await holdQuestions(userId, importId)
		startApply(userId, importId)
	}
	await refreshImports()
	return summarize(await getImportRow(userId, importId))
}

type Written = {
	row_index: number
	tmdb_id: number
	media_type: ImportMediaType
	prior_score: number | null
	applied_score: number
	undo_outcome: StoredUndoOutcome | null
}

/** The ratings of the rows as they are now: a score, or undefined where there is no rating. */
async function scoresNow(userId: string, rows: Written[]) {
	await refreshScores()
	const now = new Map<string, number | null>()
	for (const group of groupBy(rows, (item) => item.media_type))
		for (const batch of chunks(group, UNDO_BATCH)) {
			const found = await select<{ tmdb_id: number; score: number | null }>(
				`SELECT tmdb_id, score FROM user_score WHERE user_id = ? AND media_type = ? AND tmdb_id IN (${marks(batch.length)})`,
				[
					userId,
					batch[0].media_type,
					...batch.map((item) => Number(item.tmdb_id)),
				],
			)
			for (const row of found)
				now.set(
					titleRef(batch[0].media_type, Number(row.tmdb_id)),
					row.score === null ? null : Number(row.score),
				)
		}
	return (item: Written) =>
		now.get(titleRef(item.media_type, Number(item.tmdb_id)))
}

/** Whether the rating is as it was before the import: the earlier score, or no rating. */
const asBefore = (item: Written, score: number | null | undefined) =>
	item.prior_score === null
		? score === undefined
		: score === Number(item.prior_score)

async function recordUndoOutcomes(
	importId: string,
	outcomes: [number, StoredUndoOutcome][],
) {
	for (const group of groupBy(outcomes, ([, outcome]) => outcome))
		for (const batch of chunks(group, UNDO_BATCH))
			await run(
				`UPDATE doc.user_import_item SET undo_outcome = ? WHERE import_id = ? AND row_index IN (${marks(batch.length)})`,
				[batch[0][1], importId, ...batch.map(([rowIndex]) => rowIndex)],
			)
}

const undoing = new Set<string>()

/**
 * Takes back the import's episode scores, one at a time through the shared journal: a score the member changed or
 * removed after the import is left as it is, and an earlier score comes back with its dates. Rows an interrupted Undo
 * already settled keep their outcome.
 */
async function undoEpisodes(userId: string, importId: string) {
	const rows = await select<{
		row_index: number
		tmdb_id: number
		payload: string | null
		undo_outcome: StoredUndoOutcome | null
	}>(
		`SELECT row_index, tmdb_id, payload, undo_outcome FROM doc.user_import_item
		 WHERE import_id = ? AND kind = 'episode_rating' AND apply_state IN ('added', 'updated') LIMIT ${MAX_ROWS}`,
		[importId],
	)
	const outcomes: [number, StoredUndoOutcome][] = []
	for (const row of rows) {
		if (row.undo_outcome && row.undo_outcome !== "reverting") continue
		const outcome = await undoImportedEpisodeScore(userId, importId, {
			...episodeItem(row),
			undoOutcome: row.undo_outcome ?? null,
		})
		outcomes.push([Number(row.row_index), outcome])
	}
	await recordUndoOutcomes(importId, outcomes)
}

/**
 * Takes back what a finished import wrote, where the member hasn't changed it since: a rating that still holds the
 * imported score goes back to what it was, or is removed if there was none and no review has been written for it.
 */
async function undoImportStored(
	userId: string,
	importId: string,
): Promise<ImdbImportSummary> {
	const row = await getImportRow(userId, importId)
	if (row.status === "undone") return summarize(row)
	if (
		row.status !== "done" &&
		!(
			questionOptions(row).direction === "undo" &&
			(row.status === "failed" || isStalled(row))
		)
	)
		throw new ImdbImportError(409, "Only a finished import can be undone.")
	if (undoing.has(importId))
		throw new ImdbImportError(409, "This import is already being undone.")
	if (
		questionOptions(row).ask &&
		!(await claimImport(
			row,
			"status = 'running', options = ?, updated_at = CURRENT_TIMESTAMP",
			[JSON.stringify({ ...questionOptions(row), direction: "undo" })],
		))
	)
		throw new ImdbImportError(409, "This import changed. Try undo again.")
	undoing.add(importId)
	const stopUndoHeartbeat = questionOptions(row).ask
		? startHeartbeat(importId)
		: async () => {}
	// Only title ratings change Taste and the caches that follow it; until known, assume they do.
	let titles = true
	try {
		if (questionOptions(row).ask) await cancelQuestions(importId)
		await Promise.all([refreshItems(), refreshScores()])
		const written = await select<Written>(
			`SELECT row_index, tmdb_id, media_type, prior_score, applied_score, undo_outcome FROM doc.user_import_item
			 WHERE import_id = ? AND apply_state IN ('added', 'updated') AND kind IS NULL LIMIT ${MAX_ROWS}`,
			[importId],
		)
		titles = written.length > 0
		const scored = await scoredEpisodeRows(importId, row.counts)
		if (scored.length)
			await undoImportedEpisodeWatches(userId, importId, scored)
		await undoEpisodes(userId, importId)
		// Rows an earlier, interrupted Undo already settled keep their outcome. Before writing, a rating that isn't the
		// imported one any more was changed or removed by the member; one already as before is this Undo's own work
		// only where an earlier run marked it.
		const open = written.filter(
			(item) => !item.undo_outcome || item.undo_outcome === "reverting",
		)
		const before = await scoresNow(userId, open)
		const settled: [number, StoredUndoOutcome][] = []
		const todo: Written[] = []
		for (const item of open) {
			const score = before(item)
			if (score === Number(item.applied_score)) todo.push(item)
			else
				settled.push([
					Number(item.row_index),
					item.undo_outcome === "reverting" && asBefore(item, score)
						? "reverted"
						: "left",
				])
		}
		await recordUndoOutcomes(importId, [
			...settled,
			...todo.map((item): [number, StoredUndoOutcome] => [
				Number(item.row_index),
				"reverting",
			]),
		])
		const now = new Date()
		for (const group of groupBy(
			todo,
			(item) => `${item.media_type}:${item.applied_score}:${item.prior_score}`,
		)) {
			const { media_type, applied_score, prior_score } = group[0]
			for (const batch of chunks(group, UNDO_BATCH)) {
				const ids = batch.map((item) => Number(item.tmdb_id))
				if (prior_score === null)
					await run(
						`DELETE FROM user_score
						 WHERE user_id = ? AND media_type = ? AND score = ? AND (review IS NULL OR review = '') AND tmdb_id IN (${marks(ids.length)})`,
						[userId, media_type, Number(applied_score), ...ids],
					)
				else
					await run(
						`UPDATE user_score SET score = ?, updated_at = ?
						 WHERE user_id = ? AND media_type = ? AND score = ? AND tmdb_id IN (${marks(ids.length)})`,
						[
							Number(prior_score),
							now,
							userId,
							media_type,
							Number(applied_score),
							...ids,
						],
					)
			}
		}
		// A movie whose score went loses the watch that score owned; one that got its earlier score back keeps it.
		await settleImportedMovies(userId, written)
		// A rating the write didn't take back (one with a review, or changed in between) stays as the member has it.
		const after = await scoresNow(userId, todo)
		await recordUndoOutcomes(
			importId,
			todo.map((item): [number, StoredUndoOutcome] => [
				Number(item.row_index),
				asBefore(item, after(item)) ? "reverted" : "left",
			]),
		)
		for (const item of todo)
			if (asBefore(item, after(item)))
				captureProductEvent(
					userId,
					item.prior_score == null ? "rating cleared" : "rating saved",
					{
						tmdb_id: Number(item.tmdb_id),
						media_type: item.media_type,
						score: item.prior_score,
						origin: "undo",
						import_id: importId,
					},
					{
						uuid: eventUuid(
							`imdb-undo-score:${userId}:${importId}:${item.row_index}`,
						),
					},
				)
		// Every statement above is a no-op the second time, so an undo that broke off here can simply run again.
		await run(
			"UPDATE doc.user_import_item SET apply_state = 'undone' WHERE import_id = ? AND apply_state IN ('added', 'updated')",
			[importId],
		)
		await stopUndoHeartbeat()
		if (questionOptions(row).ask) await cancelQuestions(importId)
		await run(
			"UPDATE doc.user_import SET status = 'undone', updated_at = ? WHERE id = ?",
			[now, importId],
		)
		captureProductEvent(
			userId,
			"import undone",
			{ import_id: importId, origin: "undo", import_source: "imdb" },
			{ uuid: eventUuid(`import:${userId}:${importId}:undone`) },
		)
		await Promise.all([refreshItems(), refreshImports()])
	} catch (error) {
		await stopUndoHeartbeat()
		if (questionOptions(row).ask)
			await run(
				"UPDATE doc.user_import SET status = 'failed', error = ?, updated_at = ? WHERE id = ?",
				["Undo stopped. Try undo again to finish it.", new Date(), importId],
			)
		throw error
	} finally {
		await stopUndoHeartbeat()
		undoing.delete(importId)
		if (titles) await ratingsChanged(userId)
	}
	return summarize(await getImportRow(userId, importId))
}

async function apply(userId: string, importId: string) {
	return withProductContext(
		{ origin: "import", import_id: importId, batch_id: importId },
		async () => {
			captureProductEvent(
				userId,
				"import started",
				{ import_id: importId },
				{ uuid: eventUuid(`import:${userId}:${importId}:started`) },
			)
			try {
				return await applyStored(userId, importId)
			} finally {
				try {
					const row = await getImportRow(userId, importId)
					if (row.status === "done" || row.status === "failed")
						captureProductEvent(
							userId,
							row.status === "done" ? "import completed" : "import failed",
							{
								import_id: importId,
								import_source: row.source,
								added: row.added,
								updated: row.updated,
								kept: row.kept,
								failed: row.failed,
							},
							{
								uuid: eventUuid(
									`import:${userId}:${importId}:${row.status}:${row.finished_at ?? row.updated_at}`,
								),
							},
						)
				} catch {
					/* An analytics read must not change an import's outcome. */
				}
			}
		},
	)
}

export async function undoImport(userId: string, importId: string) {
	return withProductContext(
		{ origin: "undo", import_id: importId, batch_id: importId },
		() => undoImportStored(userId, importId),
	)
}
