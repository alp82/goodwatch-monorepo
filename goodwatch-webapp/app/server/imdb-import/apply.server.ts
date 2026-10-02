// Confirming an import writes its ratings to user_score; undo takes them back.
//
// Crate has no transactions, and a write that filters on anything but the whole primary key only sees rows after a
// refresh. So the apply works in batches, each one: refresh, write, refresh, read the rows back, then record per
// item what happened. Three rules keep it safe to interrupt and to run again:
// - A new rating is inserted with ON CONFLICT DO NOTHING, and an existing one is updated only while it still holds
//   the score the preview saw. A rating the member set since the preview is never overwritten.
// - Every row the import writes gets the import's confirm time as updated_at. The read-back recognises the import's
//   own writes by it, also after a restart or a write that timed out and landed later.
// - The written review, watch history, Want to See, skipped and favorites are never touched. That is why this
//   doesn't go through updateScores, which replaces the review.
import type { ImdbConflictChoice, ImdbImportCounts, ImdbImportSummary } from "~/domain/imdb-import"
import { resetOnboardingMediaCache } from "~/server/onboarding-media.server"
import { markTasteChanged } from "~/server/taste/index.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import { resetUserDataCache } from "~/server/userData.server"
import { CrateTimeoutError } from "~/utils/crate"
import { titleKey } from "~/utils/title-key"
import { titleRef } from "./classify.server"
import { ImdbImportError, type ImportMediaType, MAX_ROWS } from "./file.server"
import {
	activeRuns,
	chunks,
	getImportRow,
	isStalled,
	listImportRows,
	marks,
	type Param,
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
async function ratingsChanged(userId: string) {
	const results = await Promise.allSettled([
		resetUserDataCache({ user_id: userId }),
		markTasteChanged(userId),
		resetOnboardingMediaCache({ userId, searchTerm: "" }),
	])
	for (const result of results)
		if (result.status === "rejected") console.error("IMDb import: clearing a cache failed:", result.reason)
}

/** A row the import still has to write. */
interface Pending {
	row_index: number
	tmdb_id: number
	media_type: ImportMediaType
	imdb_score: number
	/** The member's rating when the preview was made: null means insert, a score means update from it. */
	current_score: number | null
}
type ApplyState = "added" | "updated" | "kept" | "failed"
type Tally = Record<ApplyState, number>

function groupBy<T>(list: T[], key: (item: T) => string): T[][] {
	const groups = new Map<string, T[]>()
	for (const item of list) groups.set(key(item), [...(groups.get(key(item)) ?? []), item])
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
			inserts.flatMap((item): Param[] => [userId, Number(item.tmdb_id), item.media_type, Number(item.imdb_score), stamp, stamp]),
		)
	const updates = batch.filter((item) => item.current_score !== null)
	for (const group of groupBy(updates, (item) => `${item.media_type}:${item.imdb_score}:${item.current_score}`))
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
		const rows = await select<{ tmdb_id: number; score: number | null; updated_at: number | string | Date | null }>(
			`SELECT tmdb_id, score, updated_at FROM user_score
			 WHERE user_id = ? AND media_type = ? AND tmdb_id IN (${marks(group.length)})`,
			[userId, group[0].media_type, ...group.map((item) => Number(item.tmdb_id))],
		)
		for (const row of rows)
			now.set(titleRef(group[0].media_type, Number(row.tmdb_id)), {
				score: row.score === null ? null : Number(row.score),
				ours: row.updated_at !== null && toMs(row.updated_at) === stamp.getTime(),
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
			if (row?.ours && row.score === Number(item.imdb_score)) state = insert ? "added" : "updated"
			// No row where one was inserted, or the old score where one was updated: the write didn't land.
			else if (insert ? !row : row?.score === Number(item.current_score)) state = "failed"
			// Anything else is the member's doing since the preview: they rated it, changed it or removed it.
			else state = "kept"
			states.set(item.row_index, state)
		}
		todo = todo.filter((item) => states.get(item.row_index) === "failed")
	}
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
			[state, ...(written ? [at] : []), importId, ...group.map(([rowIndex]) => rowIndex)],
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
	for (const row of rows) if (row.apply_state in tally) tally[row.apply_state as ApplyState] = Number(row.n)
	return tally
}

/** How many of the titles this import wrote have no fingerprint, so they don't count toward Taste yet. */
async function countWithoutFingerprint(importId: string): Promise<number | null> {
	const snapshot = getTitleSnapshot()
	if (!snapshot) return null
	const rows = await select<{ tmdb_id: number; media_type: ImportMediaType }>(
		`SELECT tmdb_id, media_type FROM doc.user_import_item
		 WHERE import_id = ? AND apply_state IN ('added', 'updated') LIMIT ${MAX_ROWS}`,
		[importId],
	)
	return rows.filter((row) => !snapshot.fingerprint(titleKey(row.media_type, Number(row.tmdb_id)))).length
}

/** The background task. Picks up whatever the import hasn't settled yet, so starting and resuming are the same. */
async function apply(userId: string, importId: string) {
	let wrote = false
	try {
		const row = await getImportRow(userId, importId)
		if (!row.confirmed_at || !row.conflict_choice) throw new Error("The import was never confirmed")
		const stamp = new Date(row.confirmed_at)
		const useImdb = row.conflict_choice === "imdb"

		await refreshItems()
		if (!useImdb) {
			await run(
				"UPDATE doc.user_import_item SET apply_state = 'kept' WHERE import_id = ? AND outcome = 'conflict' AND apply_state IS NULL",
				[importId],
			)
			await refreshItems()
		}
		const pending = await select<Pending>(
			`SELECT row_index, tmdb_id, media_type, imdb_score, current_score FROM doc.user_import_item
			 WHERE import_id = ? AND outcome IN ('new', 'update'${useImdb ? ", 'conflict'" : ""})
			   AND (apply_state IS NULL OR apply_state = 'failed')
			 ORDER BY row_index LIMIT ${MAX_ROWS}`,
			[importId],
		)
		// Rows that failed last time are tried again, so they start uncounted.
		const tally = { ...(await readTally(importId)), failed: 0 }
		const total = Number(row.total)
		let processed = Math.max(0, total - pending.length)
		const report = () =>
			run(
				"UPDATE doc.user_import SET processed = ?, added = ?, updated = ?, kept = ?, failed = ?, updated_at = ? WHERE id = ?",
				[processed, tally.added, tally.updated, tally.kept, tally.failed, new Date(), importId],
			)
		await report()

		for (const batch of chunks(pending, APPLY_BATCH)) {
			wrote = true
			const states = await applyBatch(userId, stamp, batch)
			await recordStates(importId, states)
			for (const state of states.values()) tally[state]++
			processed += batch.length
			await report()
		}

		await refreshItems()
		const final = await readTally(importId)
		const withoutFingerprint = await countWithoutFingerprint(importId).catch((error) => {
			console.error("IMDb import: counting titles without a fingerprint failed:", error)
			return null
		})
		const now = new Date()
		await run(
			`UPDATE doc.user_import
			 SET status = ?, error = ?, processed = ?, added = ?, updated = ?, kept = ?, failed = ?, without_fingerprint = ?, finished_at = ?, updated_at = ?
			 WHERE id = ?`,
			[
				final.failed ? "failed" : "done",
				final.failed
					? `${final.failed} ${final.failed === 1 ? "rating" : "ratings"} couldn't be saved. Try again to finish the import.`
					: null,
				total,
				final.added,
				final.updated,
				final.kept,
				final.failed,
				withoutFingerprint,
				final.failed ? null : now,
				now,
				importId,
			],
		)
	} catch (error) {
		console.error(`IMDb import ${importId} stopped:`, error)
		await run("UPDATE doc.user_import SET status = 'failed', error = ?, updated_at = ? WHERE id = ?", [
			"The import stopped before it finished. Nothing is lost: try again to finish it.",
			new Date(),
			importId,
		]).catch((failure) => console.error(`IMDb import ${importId}: recording the failure failed:`, failure))
	} finally {
		await refreshImports().catch(() => null)
		if (wrote) await ratingsChanged(userId)
	}
}

function startApply(userId: string, importId: string) {
	activeRuns.add(importId)
	// Off the request path: the client polls the import for progress. `apply` never rejects.
	void apply(userId, importId).finally(() => activeRuns.delete(importId))
}

/**
 * Starts the import, or resumes one that failed or stalled, and returns at once with status `running`.
 * A resumed import keeps the conflict choice it was started with, because part of it is already written.
 */
export async function confirmImport(userId: string, importId: string, choice: ImdbConflictChoice): Promise<ImdbImportSummary> {
	// The claims below filter on more than the key, so they need the latest state to be searchable.
	await refreshImports()
	const row = await getImportRow(userId, importId)
	if (row.status === "done") throw new ImdbImportError(409, "This import is already finished.")
	if (row.status === "undone") throw new ImdbImportError(409, "This import was undone. Upload the file again to import it.")
	if (row.status === "running" && !isStalled(row)) return summarize(row)

	const now = new Date()
	let claim: { rowcount?: number }
	if (row.status === "preview") {
		const running = await listImportRows(userId, "running")
		if (running.some((other) => !isStalled(other)))
			throw new ImdbImportError(409, "Another import is still running. Wait for it to finish, then try again.")
		const counts = JSON.parse(row.counts) as ImdbImportCounts
		const total = counts.new + counts.update + (choice === "imdb" ? counts.conflict : 0)
		claim = await run(
			`UPDATE doc.user_import SET status = 'running', conflict_choice = ?, total = ?, confirmed_at = ?, updated_at = ?
			 WHERE id = ? AND status = 'preview'`,
			[choice, total, now, now, importId],
		)
	} else {
		// Failed or stalled. Only one of several simultaneous requests gets to resume it.
		claim = await run(
			`UPDATE doc.user_import SET status = 'running', error = NULL, updated_at = ?
			 WHERE id = ? AND status = ? AND updated_at = ?`,
			[now, importId, row.status, new Date(row.updated_at)],
		)
	}
	if (claim.rowcount === 1) startApply(userId, importId)
	await refreshImports()
	return summarize(await getImportRow(userId, importId))
}

const undoing = new Set<string>()

/**
 * Takes back what a finished import wrote, where the member hasn't changed it since: a rating that still holds the
 * imported score goes back to what it was, or is removed if there was none and no review has been written for it.
 */
export async function undoImport(userId: string, importId: string): Promise<ImdbImportSummary> {
	const row = await getImportRow(userId, importId)
	if (row.status === "undone") return summarize(row)
	if (row.status !== "done") throw new ImdbImportError(409, "Only a finished import can be undone.")
	if (undoing.has(importId)) throw new ImdbImportError(409, "This import is already being undone.")
	undoing.add(importId)
	try {
		await Promise.all([refreshItems(), refreshScores()])
		const written = await select<{ tmdb_id: number; media_type: ImportMediaType; prior_score: number | null; applied_score: number }>(
			`SELECT tmdb_id, media_type, prior_score, applied_score FROM doc.user_import_item
			 WHERE import_id = ? AND apply_state IN ('added', 'updated') LIMIT ${MAX_ROWS}`,
			[importId],
		)
		const now = new Date()
		for (const group of groupBy(written, (item) => `${item.media_type}:${item.applied_score}:${item.prior_score}`)) {
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
						[Number(prior_score), now, userId, media_type, Number(applied_score), ...ids],
					)
			}
		}
		// Every statement above is a no-op the second time, so an undo that broke off here can simply run again.
		await run("UPDATE doc.user_import_item SET apply_state = 'undone' WHERE import_id = ? AND apply_state IN ('added', 'updated')", [
			importId,
		])
		await run("UPDATE doc.user_import SET status = 'undone', updated_at = ? WHERE id = ?", [now, importId])
		await Promise.all([refreshItems(), refreshImports()])
	} finally {
		undoing.delete(importId)
		await ratingsChanged(userId)
	}
	return summarize(await getImportRow(userId, importId))
}
