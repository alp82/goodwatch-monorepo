import {
	captureProductEvent,
	withProductContext,
	eventUuid,
} from "~/telemetry/product-analytics.server"
import type { UndoOutcome } from "~/domain/import-result"
import type { ImportItem, ImportOptions, ImportSummary } from "~/domain/imports"
import { canImportWantToSee } from "../../domain/imports.ts"
import {
	HEARTBEAT_MS,
	NativeImportError,
	type Param,
	activeRuns,
	claim,
	getImportRow,
	itemRows,
	recordUndo,
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
/** A list choice the row's write took away, as it was: Undo can't put it back, so the result names it. */
type Cleared = {
	table: "user_not_interested"
	createdAt: string | null
	updatedAt: string | null
}
type Journal = {
	before: Snapshot
	after: Snapshot
	stamp: string
	cleared?: Cleared[]
}
const isWant = (item: ImportItem) =>
	item.kind === "want" ||
	(item.kind === "show_status" && item.showStatus === "plan_to_watch")
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

const isoOrNull = (value: Date | string | number | null) =>
	value === null ? null : new Date(value).toISOString()

async function clearNotInterestedForWant(
	userId: string,
	importId: string,
	item: ImportItem & { payload: Record<string, unknown> },
) {
	await run("REFRESH TABLE user_not_interested")
	const row = (
		await select<{
			created_at: Date | string | number | null
			updated_at: Date | string | number | null
			_seq_no: number
			_primary_term: number
		}>(
			"SELECT created_at, updated_at, _seq_no, _primary_term FROM user_not_interested WHERE user_id = ? AND tmdb_id = ? AND media_type = ?",
			[userId, item.tmdbId, item.mediaType],
		)
	)[0]
	if (!row) return
	const journal = item.payload.journal as Journal
	// Write-ahead, like the rest of the journal: a resumed import still names the choice it took away.
	const named = !!journal.cleared?.length
	if (!named)
		await persistJournal(importId, item, {
			...journal,
			cleared: [
				{
					table: "user_not_interested",
					createdAt: isoOrNull(row.created_at),
					updatedAt: isoOrNull(row.updated_at),
				},
			],
		})
	const removed = await run(
		"DELETE FROM user_not_interested WHERE user_id = ? AND tmdb_id = ? AND media_type = ? AND _seq_no = ? AND _primary_term = ?",
		[
			userId,
			item.tmdbId,
			item.mediaType,
			Number(row._seq_no),
			Number(row._primary_term),
		],
	)
	// The member changed it in between: the import took nothing away.
	if (removed.rowcount === 0 && !named)
		await persistJournal(importId, item, journal)
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

async function canApplyWishlistShow(
	userId: string,
	item: ImportItem,
	allowRewatch: boolean,
) {
	if (
		!item.wishlistEvidence ||
		item.mediaType !== "show" ||
		item.tmdbId === null
	)
		return true
	const { getImportStatusSnapshots } = await import("../tracking.server.ts")
	const snapshots = await getImportStatusSnapshots(userId, [item.tmdbId])
	const current = snapshots.get(item.tmdbId)
	return current?.state?.state === "seen"
		? allowRewatch
		: canImportWantToSee(current?.state?.state, !!current?.hasWatches)
}

async function applySet(
	userId: string,
	importId: string,
	item: ImportItem & { payload: Record<string, unknown> },
	table: "user_wishlist" | "user_favorite",
	allowRewatch = false,
) {
	let journal = item.payload.journal as Journal | undefined
	if (item.kind === "show_status" && item.tmdbId !== null) {
		const { getShowTracking } = await import("../tracking.server.ts")
		const copy = await getShowTracking(userId, item.tmdbId)
		if (!canImportWantToSee(copy.state?.state, copy.log.length > 0))
			return "kept" as const
	}
	if (!journal) {
		await run(
			`REFRESH TABLE ${table}${table === "user_wishlist" ? ", user_watch_log" : ""}`,
		)
		if (
			table === "user_wishlist" &&
			!(await canApplyWishlistShow(userId, item, allowRewatch))
		)
			return "kept" as const
		if (table === "user_wishlist" && !(item.wishlistEvidence && allowRewatch)) {
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
				await clearNotInterestedForWant(userId, importId, item)
			return "added" as const
		}
		if (own) return "kept" as const
		if (
			table === "user_wishlist" &&
			!(await canApplyWishlistShow(userId, item, allowRewatch))
		)
			return "kept" as const
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
		await clearNotInterestedForWant(userId, importId, item)
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
		"SELECT apply_state, count(*) AS n FROM doc.user_import_item WHERE import_id = ? AND kind <> 'state' AND kind <> 'resolution' GROUP BY apply_state",
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

async function applyRunStored(
	userId: string,
	id: string,
	options: ImportOptions,
) {
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
		const rewatchWishes: typeof pending = []
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
					((item.wishlistShowChoice && options.wishlistShows !== true) ||
						(item.wishlistRewatchChoice !== false &&
							options.conflictChoice === "keep"))
				)
					state = "kept"
				else if (
					isWant(item) &&
					item.wishlistRewatchChoice &&
					watchRefs.has(ref(item)) &&
					options.conflictChoice === "source"
				) {
					// A source can contain both past watches and a current rewatch intention.
					// Add the intention after the watch writer has cleared earlier wishes.
					rewatchWishes.push(item)
					continue
				} else if (isWant(item) && watchRefs.has(ref(item))) state = "kept"
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
				} else if (isWant(item))
					state = await applySet(
						userId,
						id,
						item,
						"user_wishlist",
						options.conflictChoice === "source",
					)
				else if (item.kind === "favorite")
					state = await applySet(userId, id, item, "user_favorite")
				// Watch rows are applied by the tracking phase below. Until a plan is available, leave them pending.
				else if (item.kind === "watch" || item.kind === "show_status") continue
			} catch {
				state = "failed"
			}
			tally[state]++
			await markItem(id, item, state)
			if (
				(state === "added" || state === "updated") &&
				(item.kind === "rating" ||
					item.kind === "review" ||
					isWant(item) ||
					item.kind === "favorite")
			)
				captureProductEvent(
					userId,
					isWant(item)
						? "want to see added"
						: item.kind === "favorite"
							? "favorite added"
							: item.kind === "review"
								? "review saved"
								: "rating saved",
					{
						tmdb_id: item.tmdbId ?? undefined,
						media_type: item.mediaType,
						score: item.score ?? undefined,
						has_review: Boolean(item.review),
						origin: "import",
						import_id: id,
					},
					{ uuid: eventUuid(`import-item:${userId}:${id}:${item.index}`) },
				)
			await recount(id)
		}
		// tracking.server.ts completes watch items and stores its plans; imported lazily to keep parser-only tests light.
		await refreshItems()
		const watchPending = (await itemRows(userId, id, true)).filter(
			(item) => item.kind === "watch" || item.kind === "show_status",
		)
		if (watchPending.length) {
			const tracking = await import("./watch-items.server.ts")
			await tracking.applyPendingImportWatches(userId, id, options)
		}
		for (const item of rewatchWishes) {
			let state: "added" | "kept" | "failed"
			try {
				state = await applySet(userId, id, item, "user_wishlist", true)
			} catch {
				state = "failed"
			}
			await markItem(id, item, state)
			if (state === "added")
				captureProductEvent(
					userId,
					"want to see added",
					{
						tmdb_id: item.tmdbId ?? undefined,
						media_type: item.mediaType,
						origin: "import",
						import_id: id,
					},
					{ uuid: eventUuid(`import-item:${userId}:${id}:${item.index}`) },
				)
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
	if (row.source === "tvtime" && row.status === "preview")
		await (await import("./resolution-runtime.server.ts")).cancelResolution(
			userId,
			id,
		)
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
				wishlistShows: stored.wishlistShows,
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

type UndoItem = Awaited<ReturnType<typeof itemRows>>[number]

/** Takes back one rating or review row. It is left as it is when the member changed it after the import. */
async function undoScore(
	userId: string,
	importId: string,
	item: UndoItem,
): Promise<UndoOutcome> {
	const journal = item.payload.journal as Journal | undefined
	if (!journal) return "not_restored"
	const current = await scoreSnapshot(userId, item)
	// As before the import already: an earlier, interrupted Undo got this far if it marked the row; otherwise
	// the member changed it back, or removed it.
	if (
		journal.before.exists
			? current.exists &&
				current.score === (journal.before.score ?? null) &&
				current.review === (journal.before.review ?? null)
			: !current.exists
	)
		return item.undoOutcome === "reverting" ? "reverted" : "left"
	if (!sameScore(current, journal.after)) return "left"
	if (current.seq === undefined || current.term === undefined) return "left"
	// An older journal without the earlier dates can't put the earlier rating back exactly.
	if (
		journal.before.exists &&
		(!journal.before.createdAt || !journal.before.updatedAt)
	)
		return "not_restored"
	await recordUndo(importId, item.index, "reverting")
	let result: { rowcount?: number }
	if (!journal.before.exists)
		result = await run(
			"DELETE FROM user_score WHERE user_id = ? AND tmdb_id = ? AND media_type = ? AND _seq_no = ? AND _primary_term = ?",
			[userId, item.tmdbId, item.mediaType, current.seq, current.term],
		)
	else {
		const createdAt = journal.before.createdAt ?? ""
		const updatedAt = journal.before.updatedAt ?? ""
		result = await run(
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
	if (result.rowcount)
		captureProductEvent(
			userId,
			item.kind === "review"
				? "review saved"
				: journal.before.score == null
					? "rating cleared"
					: "rating saved",
			{
				tmdb_id: item.tmdbId ?? undefined,
				media_type: item.mediaType,
				score: journal.before.score ?? null,
				origin: "undo",
				import_id: importId,
			},
			{
				uuid: eventUuid(
					`import-undo-score:${userId}:${importId}:${item.index}`,
				),
			},
		)
	return result.rowcount === 0 ? "left" : "reverted"
}

/** Takes back one Want to See or favorite row, unless the member changed it after the import. */
async function undoSet(
	userId: string,
	importId: string,
	item: UndoItem,
	table: "user_wishlist" | "user_favorite",
): Promise<UndoOutcome> {
	const journal = item.payload.journal as Journal | undefined
	if (!journal) return "not_restored"
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
	// Gone already: an earlier, interrupted Undo took it off if it marked the row; otherwise the member did.
	if (!current) return item.undoOutcome === "reverting" ? "reverted" : "left"
	if (
		new Date(current.created_at).toISOString() !== journal.after.createdAt ||
		new Date(current.updated_at).toISOString() !== journal.stamp
	)
		return "left"
	await recordUndo(importId, item.index, "reverting")
	const result = await run(
		`DELETE FROM ${table} WHERE user_id = ? AND tmdb_id = ? AND media_type = ? AND _seq_no = ? AND _primary_term = ?`,
		[
			userId,
			item.tmdbId,
			item.mediaType,
			Number(current._seq_no),
			Number(current._primary_term),
		],
	)
	return result.rowcount === 0 ? "left" : "reverted"
}

async function undoImportStored(
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
					item.kind === "watch" ||
					item.kind === "show_status" ||
					String(item.key).startsWith("state:"),
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
			if (
				!item.applyState ||
				!["added", "updated"].includes(item.applyState) ||
				(item.undoOutcome && item.undoOutcome !== "reverting")
			)
				continue
			let outcome: UndoOutcome | null = null
			if (item.kind === "rating" || item.kind === "review")
				outcome = await undoScore(userId, id, item)
			else if (isWant(item) || item.kind === "favorite")
				outcome = await undoSet(
					userId,
					id,
					item,
					isWant(item) ? "user_wishlist" : "user_favorite",
				)
			if (outcome) await recordUndo(id, item.index, outcome)
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
		captureProductEvent(
			userId,
			"import undone",
			{ import_id: id, origin: "undo", import_source: row.source },
			{ uuid: eventUuid(`import:${userId}:${id}:undone`) },
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

async function applyRun(userId: string, id: string, options: ImportOptions) {
	return withProductContext(
		{ origin: "import", import_id: id, batch_id: id },
		async () => {
			captureProductEvent(
				userId,
				"import started",
				{ import_id: id },
				{ uuid: eventUuid(`import:${userId}:${id}:started`) },
			)
			try {
				return await applyRunStored(userId, id, options)
			} finally {
				try {
					const row = await getImportRow(userId, id)
					if (row.status === "done" || row.status === "failed")
						captureProductEvent(
							userId,
							row.status === "done" ? "import completed" : "import failed",
							{
								import_id: id,
								import_source: row.source,
								added: row.added,
								updated: row.updated,
								kept: row.kept,
								failed: row.failed,
							},
							{
								uuid: eventUuid(
									`import:${userId}:${id}:${row.status}:${row.finished_at ?? row.updated_at}`,
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
