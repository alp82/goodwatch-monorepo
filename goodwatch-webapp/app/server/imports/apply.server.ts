import type { ImportItem, ImportOptions, ImportSummary } from "~/domain/imports"
import {
	HEARTBEAT_MS,
	NativeImportError,
	type Param,
	activeRuns,
	claim,
	getImportRow,
	itemRows,
	refreshImports,
	refreshItems,
	run,
	select,
	summarize,
} from "./store.server.ts"

type Snapshot = {
	exists: boolean
	score?: number | null
	review?: string | null
	createdAt?: string
	updatedAt?: string
	seq?: number
	term?: number
}
type Journal = { before: Snapshot; after: Snapshot; stamp: string }
const ref = (item: ImportItem) => `${item.mediaType}:${item.tmdbId}`
async function defaultImportEffects(userId: string) {
	const [{ resetUserDataCache }, { markTasteChanged }] = await Promise.all([
		import("~/server/userData.server"),
		import("~/server/taste/index.server"),
	])
	await Promise.all([
		resetUserDataCache({ user_id: userId }),
		markTasteChanged(userId),
	])
}
let resetMemberData = defaultImportEffects
let ratingEffects = settleRatings
/** Test-only effect boundary; passing no value restores the member-data reset. */
export const setImportEffectsForTest = (
	reset?: (userId: string) => Promise<void>,
	ratings?: (userId: string, movieIds: number[]) => Promise<void>,
) => {
	resetMemberData = reset ?? defaultImportEffects
	ratingEffects = ratings ?? settleRatings
}
async function settleRatings(userId: string, movieIds: number[]) {
	if (!movieIds.length) return
	const { settleMovies } = await import("~/server/tracking.server")
	await settleMovies(userId, [...new Set(movieIds)])
}

async function clearNotInterestedForWant(userId: string, item: ImportItem) {
	await run("REFRESH TABLE user_not_interested")
	const row = (
		await select<{ _seq_no: number; _primary_term: number }>(
			"SELECT _seq_no, _primary_term FROM user_not_interested WHERE user_id = ? AND tmdb_id = ? AND media_type = ?",
			[userId, item.tmdbId, item.mediaType],
		)
	)[0]
	if (row)
		await run(
			"DELETE FROM user_not_interested WHERE user_id = ? AND tmdb_id = ? AND media_type = ? AND _seq_no = ? AND _primary_term = ?",
			[
				userId,
				item.tmdbId,
				item.mediaType,
				Number(row._seq_no),
				Number(row._primary_term),
			],
		)
}

async function scoreSnapshot(
	userId: string,
	item: ImportItem,
): Promise<Snapshot> {
	await run("REFRESH TABLE user_score")
	const row = (
		await select<{
			score: number | null
			review: string | null
			created_at: Date | string
			updated_at: Date | string
			_seq_no: number
			_primary_term: number
		}>(
			"SELECT score, review, created_at, updated_at, _seq_no, _primary_term FROM user_score WHERE user_id = ? AND tmdb_id = ? AND media_type = ?",
			[userId, item.tmdbId, item.mediaType],
		)
	)[0]
	return row
		? {
				exists: true,
				score: row.score === null ? null : Number(row.score),
				review: row.review,
				createdAt: new Date(row.created_at).toISOString(),
				updatedAt: new Date(row.updated_at).toISOString(),
				seq: Number(row._seq_no),
				term: Number(row._primary_term),
			}
		: { exists: false }
}
const sameScore = (a: Snapshot, b: Snapshot) =>
	a.exists === b.exists &&
	(!a.exists ||
		(a.score === b.score &&
			a.review === b.review &&
			a.updatedAt === b.updatedAt))

async function persistJournal(
	importId: string,
	item: ImportItem & { payload: Record<string, unknown> },
	journal: Journal,
) {
	const payload = { ...item.payload, journal }
	await run(
		"UPDATE doc.user_import_item SET payload = ? WHERE import_id = ? AND row_index = ?",
		[JSON.stringify(payload), importId, item.index],
	)
	item.payload = payload
}

async function applyScoreLike(
	userId: string,
	importId: string,
	item: ImportItem & { payload: Record<string, unknown> },
	own: Snapshot[],
): Promise<"added" | "updated" | "kept" | "failed"> {
	let journal = item.payload.journal as Journal | undefined
	if (!journal) {
		const before = await scoreSnapshot(userId, item)
		const preview = item.payload._preview as
			| {
					score: number | null
					review: string | null
					updatedAt: string
					seq: number
					term: number
			  }
			| null
			| undefined
		const changedByThisImport = own.some((snapshot) =>
			sameScore(before, snapshot),
		)
		if (
			!changedByThisImport &&
			((preview == null) !== !before.exists ||
				(preview &&
					(!before.exists ||
						preview.seq !== before.seq ||
						preview.term !== before.term)))
		)
			return "kept"
		const stamp = new Date().toISOString()
		const after: Snapshot = {
			exists: true,
			score:
				item.kind === "rating" ? (item.score ?? null) : (before.score ?? null),
			review:
				item.kind === "review"
					? (item.review ?? null)
					: (before.review ?? null),
			createdAt: before.createdAt ?? stamp,
			updatedAt: stamp,
		}
		journal = { before, after, stamp }
		await persistJournal(importId, item, journal)
	}
	const now = await scoreSnapshot(userId, item)
	if (sameScore(now, journal.after))
		return journal.before.exists ? "updated" : "added"
	if (!sameScore(now, journal.before)) {
		if (!own.some((snapshot) => sameScore(now, snapshot))) return "kept"
		// Another row of this same import landed first (for example a review after a rating write timed out).
		// Rebase this row's receipt onto that durable stage before changing it, preserving the other field.
		const stamp = new Date(
			Math.max(Date.now(), now.updatedAt ? Date.parse(now.updatedAt) + 1 : 0),
		).toISOString()
		journal = {
			before: now,
			after: {
				exists: true,
				score:
					item.kind === "rating" ? (item.score ?? null) : (now.score ?? null),
				review:
					item.kind === "review" ? (item.review ?? null) : (now.review ?? null),
				createdAt: now.createdAt,
				updatedAt: stamp,
			},
			stamp,
		}
		await persistJournal(importId, item, journal)
	}
	if (!journal.before.exists) {
		await run(
			"INSERT INTO user_score (user_id,tmdb_id,media_type,score,review,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT (user_id,tmdb_id,media_type) DO NOTHING",
			[
				userId,
				item.tmdbId ?? null,
				item.mediaType,
				journal.after.score ?? null,
				journal.after.review ?? null,
				new Date(journal.stamp),
				new Date(journal.stamp),
			] as Param[],
		)
	} else {
		await run(
			"UPDATE user_score SET score = ?, review = ?, updated_at = ? WHERE user_id = ? AND tmdb_id = ? AND media_type = ? AND _seq_no = ? AND _primary_term = ?",
			[
				journal.after.score ?? null,
				journal.after.review ?? null,
				new Date(journal.stamp),
				userId,
				item.tmdbId ?? null,
				item.mediaType,
				journal.before.seq ?? null,
				journal.before.term ?? null,
			] as Param[],
		)
	}
	return sameScore(await scoreSnapshot(userId, item), journal.after)
		? journal.before.exists
			? "updated"
			: "added"
		: "failed"
}

async function applySet(
	userId: string,
	importId: string,
	item: ImportItem & { payload: Record<string, unknown> },
	table: "user_wishlist" | "user_favorite",
) {
	let journal = item.payload.journal as Journal | undefined
	if (!journal) {
		await run(
			`REFRESH TABLE ${table}${table === "user_wishlist" ? ", user_watch_log" : ""}`,
		)
		if (table === "user_wishlist") {
			const watched = await select<{ watch_id: string }>(
				"SELECT watch_id FROM user_watch_log WHERE user_id = ? AND tmdb_id = ? AND media_type = ? LIMIT 1",
				[userId, item.tmdbId, item.mediaType],
			)
			if (watched.length) return "kept" as const
		}
		const exists = (
			await select<{
				created_at: Date | string
				updated_at: Date | string
				_seq_no: number
				_primary_term: number
			}>(
				`SELECT created_at, updated_at, _seq_no, _primary_term FROM ${table} WHERE user_id = ? AND tmdb_id = ? AND media_type = ?`,
				[userId, item.tmdbId, item.mediaType],
			)
		)[0]
		if (exists) return "kept" as const
		const stamp = new Date().toISOString()
		const sourceAdded =
			item.addedAt && Number.isFinite(Date.parse(item.addedAt))
				? new Date(item.addedAt).toISOString()
				: stamp
		journal = {
			before: { exists: false },
			after: { exists: true, createdAt: sourceAdded, updatedAt: stamp },
			stamp,
		}
		await persistJournal(importId, item, journal)
	} else {
		await run(`REFRESH TABLE ${table}`)
		const own = (
			await select<{ created_at: Date | string; updated_at: Date | string }>(
				`SELECT created_at, updated_at FROM ${table} WHERE user_id = ? AND tmdb_id = ? AND media_type = ?`,
				[userId, item.tmdbId, item.mediaType],
			)
		)[0]
		if (
			own &&
			new Date(own.created_at).toISOString() === journal.after.createdAt &&
			new Date(own.updated_at).toISOString() === journal.stamp
		) {
			if (table === "user_wishlist")
				await clearNotInterestedForWant(userId, item)
			return "added" as const
		}
		if (own) return "kept" as const
	}
	const createdAt = journal.after.createdAt
	if (!createdAt)
		throw new Error("The import set receipt has no creation time.")
	const result = await run(
		`INSERT INTO ${table} (user_id,tmdb_id,media_type,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT (user_id,tmdb_id,media_type) DO NOTHING`,
		[
			userId,
			item.tmdbId,
			item.mediaType,
			new Date(createdAt),
			new Date(journal.stamp),
		],
	)
	if (result.rowcount === 1 && table === "user_wishlist")
		await clearNotInterestedForWant(userId, item)
	return result.rowcount === 1 ? ("added" as const) : ("kept" as const)
}

async function markItem(
	importId: string,
	item: ImportItem,
	state: "added" | "updated" | "kept" | "failed",
) {
	await run(
		"UPDATE doc.user_import_item SET apply_state = ?, applied_at = CURRENT_TIMESTAMP WHERE import_id = ? AND row_index = ? AND (apply_state IS NULL OR apply_state = 'failed')",
		[state, importId, item.index],
	)
}

export async function recount(importId: string) {
	await refreshItems()
	const rows = await select<{ apply_state: string | null; n: number }>(
		"SELECT apply_state, count(*) AS n FROM doc.user_import_item WHERE import_id = ? AND kind <> 'state' GROUP BY apply_state",
		[importId],
	)
	const tally = { added: 0, updated: 0, kept: 0, failed: 0, processed: 0 }
	for (const row of rows)
		if (row.apply_state && row.apply_state in tally) {
			const n = Number(row.n)
			tally[row.apply_state as "added" | "updated" | "kept" | "failed"] += n
			tally.processed += n
		}
	await run(
		"UPDATE doc.user_import SET processed = ?, added = ?, updated = ?, kept = ?, failed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		[
			tally.processed,
			tally.added,
			tally.updated,
			tally.kept,
			tally.failed,
			importId,
		],
	)
	return tally
}

async function applyRun(userId: string, id: string, options: ImportOptions) {
	if (activeRuns.has(id)) return
	activeRuns.add(id)
	let beat: NodeJS.Timeout | undefined
	try {
		beat = setInterval(
			() =>
				void run(
					"UPDATE doc.user_import SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
					[id],
				).catch(() => null),
			HEARTBEAT_MS,
		)
		beat.unref()
		const pending = await itemRows(userId, id, true)
		const allItems = await itemRows(userId, id)
		const ownScores = new Map<string, Snapshot[]>()
		for (const item of allItems) {
			const journal = item.payload.journal as Journal | undefined
			if (journal && (item.kind === "rating" || item.kind === "review"))
				ownScores.set(ref(item), [
					...(ownScores.get(ref(item)) ?? []),
					journal.after,
				])
		}
		const watchRefs = new Set(
			pending
				.filter(
					(x) =>
						x.kind === "watch" &&
						x.outcome === "new" &&
						options.kinds.includes("watch") &&
						x.tmdbId !== null,
				)
				.map(ref),
		)
		const tally = { added: 0, updated: 0, kept: 0, failed: 0 }
		for (const item of pending) {
			let state: keyof typeof tally = "kept"
			try {
				if (
					item.kind === "unsupported" ||
					!options.kinds.includes(item.kind) ||
					["unmatched", "unsupported", "invalid", "unchanged"].includes(
						item.outcome,
					)
				)
					state = "kept"
				else if (
					item.outcome === "conflict" &&
					options.conflictChoice === "keep"
				)
					state = "kept"
				else if (item.kind === "want" && watchRefs.has(ref(item)))
					state = "kept"
				else if (item.kind === "rating" || item.kind === "review") {
					state = await applyScoreLike(
						userId,
						id,
						item,
						ownScores.get(ref(item)) ?? [],
					)
					const journal = item.payload.journal as Journal | undefined
					if (journal)
						ownScores.set(ref(item), [
							...(ownScores.get(ref(item)) ?? []),
							journal.after,
						])
				} else if (item.kind === "want")
					state = await applySet(userId, id, item, "user_wishlist")
				else if (item.kind === "favorite")
					state = await applySet(userId, id, item, "user_favorite")
				// Watch rows are applied by the tracking phase below. Until a plan is available, leave them pending.
				else if (item.kind === "watch") continue
			} catch {
				state = "failed"
			}
			tally[state]++
			await markItem(id, item, state)
			await recount(id)
		}
		// tracking.server.ts completes watch items and stores its plans; imported lazily to keep parser-only tests light.
		await refreshItems()
		const watchPending = (await itemRows(userId, id, true)).filter(
			(item) => item.kind === "watch",
		)
		if (watchPending.length) {
			const tracking = await import("./watch-items.server.ts")
			await tracking.applyPendingImportWatches(userId, id, options)
		}
		await refreshItems()
		const appliedRatings = (await itemRows(userId, id)).filter(
			(x) =>
				x.kind === "rating" &&
				x.mediaType === "movie" &&
				(x.applyState === "added" || x.applyState === "updated") &&
				x.tmdbId !== null,
		)
		await ratingEffects(
			userId,
			appliedRatings.flatMap((x) => (x.tmdbId === null ? [] : [x.tmdbId])),
		)
		const left = await itemRows(userId, id, true)
		const failed = left.filter((x) => x.kind !== "unsupported").length
		await recount(id)
		await run(
			"UPDATE doc.user_import SET status = ?, finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, error = ? WHERE id = ?",
			[
				failed ? "failed" : "done",
				failed
					? "Some rows could not be applied. Try again to finish the import."
					: null,
				id,
			],
		)
		await refreshImports()
		await resetMemberData(userId)
	} catch (error) {
		console.error("Native import apply stopped:", error)
		await run(
			"UPDATE doc.user_import SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
			["The import stopped before it finished. Try again to resume it.", id],
		).catch(() => null)
	} finally {
		if (beat) clearInterval(beat)
		activeRuns.delete(id)
	}
}

export async function confirmImport(
	userId: string,
	id: string,
	options: ImportOptions,
): Promise<ImportSummary> {
	const row = await getImportRow(userId, id)
	const stored = row.options
		? (JSON.parse(row.options) as ImportOptions & { direction?: string })
		: null
	if (stored?.direction === "undo")
		throw new NativeImportError(
			409,
			"This import is being undone. Try undo again to resume it.",
		)
	const effectiveOptions = stored
		? {
				kinds: stored.kinds,
				conflictChoice: stored.conflictChoice,
				watchDates: stored.watchDates,
			}
		: options
	if (row.status === "done" || row.status === "undone") return summarize(row)
	if (row.status === "running" && !summarize(row).stalled) return summarize(row)
	if (!["preview", "failed", "running"].includes(row.status))
		return summarize(row)
	const started = await claim(
		row,
		"status = 'running', options = ?, conflict_choice = ?, confirmed_at = COALESCE(confirmed_at,CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP, error = NULL",
		[
			JSON.stringify({ ...effectiveOptions, direction: "apply" }),
			effectiveOptions.conflictChoice,
		],
	)
	if (started) void applyRun(userId, id, effectiveOptions)
	await refreshImports()
	return summarize(await getImportRow(userId, id))
}

async function undoScore(
	userId: string,
	item: ImportItem & { payload: Record<string, unknown> },
) {
	const journal = item.payload.journal as Journal | undefined
	const current = await scoreSnapshot(userId, item)
	if (!journal || !sameScore(current, journal.after)) return
	if (current.seq === undefined || current.term === undefined) return
	if (!journal.before.exists)
		await run(
			"DELETE FROM user_score WHERE user_id = ? AND tmdb_id = ? AND media_type = ? AND _seq_no = ? AND _primary_term = ?",
			[userId, item.tmdbId, item.mediaType, current.seq, current.term],
		)
	else {
		const createdAt = journal.before.createdAt
		const updatedAt = journal.before.updatedAt
		if (!createdAt || !updatedAt) return
		await run(
			"UPDATE user_score SET score = ?, review = ?, created_at = ?, updated_at = ? WHERE user_id = ? AND tmdb_id = ? AND media_type = ? AND _seq_no = ? AND _primary_term = ?",
			[
				journal.before.score ?? null,
				journal.before.review ?? null,
				new Date(createdAt),
				new Date(updatedAt),
				userId,
				item.tmdbId,
				item.mediaType,
				current.seq,
				current.term,
			],
		)
	}
}

async function undoSet(
	userId: string,
	item: ImportItem & { payload: Record<string, unknown> },
	table: "user_wishlist" | "user_favorite",
) {
	const journal = item.payload.journal as Journal | undefined
	if (!journal) return
	await run(`REFRESH TABLE ${table}`)
	const current = (
		await select<{
			created_at: Date | string
			updated_at: Date | string
			_seq_no: number
			_primary_term: number
		}>(
			`SELECT created_at, updated_at, _seq_no, _primary_term FROM ${table} WHERE user_id = ? AND tmdb_id = ? AND media_type = ?`,
			[userId, item.tmdbId, item.mediaType],
		)
	)[0]
	if (
		!current ||
		new Date(current.created_at).toISOString() !== journal.after.createdAt ||
		new Date(current.updated_at).toISOString() !== journal.stamp
	)
		return
	await run(
		`DELETE FROM ${table} WHERE user_id = ? AND tmdb_id = ? AND media_type = ? AND _seq_no = ? AND _primary_term = ?`,
		[
			userId,
			item.tmdbId,
			item.mediaType,
			Number(current._seq_no),
			Number(current._primary_term),
		],
	)
}

export async function undoImport(
	userId: string,
	id: string,
): Promise<ImportSummary> {
	const row = await getImportRow(userId, id)
	if (row.status === "undone") return summarize(row)
	const stored = row.options
		? (JSON.parse(row.options) as ImportOptions & { direction?: string })
		: null
	if (
		row.status === "running" &&
		stored?.direction === "undo" &&
		!summarize(row).stalled
	)
		return summarize(row)
	if (
		row.status !== "done" &&
		!(
			["failed", "running"].includes(row.status) && stored?.direction === "undo"
		)
	)
		throw new NativeImportError(409, "Only a finished import can be undone.")
	if (
		!(await claim(
			row,
			"status = 'running', options = ?, updated_at = CURRENT_TIMESTAMP, error = NULL",
			[JSON.stringify({ ...(stored ?? {}), direction: "undo" })],
		))
	)
		return summarize(await getImportRow(userId, id))
	activeRuns.add(id)
	const beat = setInterval(
		() =>
			void run(
				"UPDATE doc.user_import SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
				[id],
			).catch(() => null),
		HEARTBEAT_MS,
	)
	beat.unref()
	try {
		const items = await itemRows(userId, id)
		if (
			items.some(
				(item) =>
					item.kind === "watch" || String(item.key).startsWith("state:"),
			)
		) {
			const tracking = await import("./watch-items.server.ts")
			await tracking.undoAppliedImportWatches(userId, id)
		}
		const undoOrder = [...items].sort((a, b) => {
			const aStamp = (a.payload.journal as Journal | undefined)?.stamp
			const bStamp = (b.payload.journal as Journal | undefined)?.stamp
			return (
				(bStamp ? Date.parse(bStamp) : 0) - (aStamp ? Date.parse(aStamp) : 0) ||
				b.index - a.index
			)
		})
		for (const item of undoOrder) {
			if (!item.applyState || !["added", "updated"].includes(item.applyState))
				continue
			if (item.kind === "rating" || item.kind === "review")
				await undoScore(userId, item)
			else if (item.kind === "want" || item.kind === "favorite") {
				await undoSet(
					userId,
					item,
					item.kind === "want" ? "user_wishlist" : "user_favorite",
				)
			}
		}
		const movieRatings = items.filter(
			(x) =>
				x.kind === "rating" && x.mediaType === "movie" && x.tmdbId !== null,
		)
		await ratingEffects(
			userId,
			movieRatings.flatMap((x) => (x.tmdbId === null ? [] : [x.tmdbId])),
		)
		await run(
			"UPDATE doc.user_import_item SET apply_state = 'undone' WHERE import_id = ? AND apply_state IN ('added','updated')",
			[id],
		)
		await run(
			"UPDATE doc.user_import SET status = 'undone', updated_at = CURRENT_TIMESTAMP, finished_at = CURRENT_TIMESTAMP WHERE id = ?",
			[id],
		)
		await resetMemberData(userId)
		await refreshImports()
		return summarize(await getImportRow(userId, id))
	} catch (error) {
		console.error("Native import undo stopped:", error)
		await run(
			"UPDATE doc.user_import SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
			["Undo stopped before it finished. Try again to resume it.", id],
		).catch(() => null)
		throw error
	} finally {
		clearInterval(beat)
		activeRuns.delete(id)
	}
}
