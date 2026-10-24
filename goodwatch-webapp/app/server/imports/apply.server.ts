import type { UndoOutcome } from "~/domain/import-result"
import type {
	ImportAnswer,
	ImportItem,
	ImportOptions,
	ImportQuestion,
	ImportSource,
	ImportSummary,
} from "~/domain/imports"
import {
	captureProductEvent,
	eventUuid,
	withProductContext,
} from "~/telemetry/product-analytics.server"
import { QUESTION_KEPT_REASON } from "../../domain/import-result.ts"
import { canImportWantToSee, importGate } from "../../domain/imports.ts"
import {
	applyImportedEpisodeScore,
	undoImportedEpisodeScore,
} from "./episode-score-apply.server.ts"
import {
	HEARTBEAT_MS,
	NativeImportError,
	type Param,
	activeRuns,
	chunks,
	claim,
	getImportRow,
	itemRows,
	marks,
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
		(!item.wishlistEvidence && !(item.wishlistRewatchChoice && allowRewatch)) ||
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
		if (
			table === "user_wishlist" &&
			!(item.wishlistRewatchChoice && allowRewatch)
		) {
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
	item: ImportItem & { payload: Record<string, unknown> },
	state: "added" | "updated" | "kept" | "failed",
	reason?: string,
) {
	if (state === "failed" && item.applyState?.startsWith("approved:")) {
		// Save the row's consent before replacing its approval with the retryable failure.
		const question = item.applyState.slice(9) as ImportQuestion
		item.payload._answer = {
			...(item.payload._answer as object),
			[question]: question === "conflict" ? "source" : "add",
		}
		await run(
			"UPDATE doc.user_import_item SET payload = ? WHERE import_id = ? AND row_index = ?",
			[JSON.stringify(item.payload), importId, item.index],
		)
	}
	await run(
		`UPDATE doc.user_import_item SET apply_state = ?, applied_at = CURRENT_TIMESTAMP${reason ? ", reason = ?" : ""} WHERE import_id = ? AND row_index = ? AND (apply_state IS NULL OR apply_state = 'failed' OR apply_state LIKE 'approved:%')`,
		[state, ...(reason ? [reason] : []), importId, item.index],
	)
}

export const questionStates = (importId: string) =>
	select<{ apply_state: string | null; n: number }>(
		"SELECT apply_state, count(*) AS n FROM doc.user_import_item WHERE import_id = ? AND kind <> 'state' AND kind <> 'resolution' GROUP BY apply_state",
		[importId],
	)
export async function recount(importId: string) {
	await refreshItems()
	const rows = await questionStates(importId)
	const tally = { added: 0, updated: 0, kept: 0, failed: 0, processed: 0 }
	for (const row of rows) {
		if (row.apply_state?.startsWith("waiting:"))
			tally.processed += Number(row.n)
		if (row.apply_state && row.apply_state in tally) {
			const n = Number(row.n)
			tally[row.apply_state as "added" | "updated" | "kept" | "failed"] += n
			tally.processed += n
		}
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
	return { ...tally, states: rows }
}

/** Hold only untouched rows; retries cannot overwrite a decision or a journal. */
export async function holdQuestions(
	userId: string,
	id: string,
	options: ImportOptions,
) {
	if (!options.ask?.length) return
	const held = new Map<ImportQuestion, number[]>()
	for (const item of await itemRows(userId, id, false, true)) {
		const gate = importGate(item, options)
		if ("hold" in gate) {
			if (!held.has(gate.hold)) held.set(gate.hold, [])
			held.get(gate.hold)?.push(item.index)
		}
	}
	for (const [question, indexes] of held)
		for (const batch of chunks(indexes, 800))
			await run(
				`UPDATE doc.user_import_item SET apply_state = 'waiting:${question}' WHERE import_id = ? AND apply_state IS NULL AND row_index IN (${marks(batch.length)})`,
				[id, ...batch],
			)
	await refreshItems()
	await recount(id)
}

async function transitionConflict(
	id: string,
	answer: ImportAnswer,
	indexes: number[] | null,
) {
	let decided = 0
	for (const batch of indexes ? chunks(indexes, 500) : [null]) {
		const result = await run(
			`UPDATE doc.user_import_item SET apply_state = ?, applied_at = CURRENT_TIMESTAMP${answer === "keep" ? ", reason = 'You chose to keep what GoodWatch has.'" : ""} WHERE import_id = ? AND apply_state = 'waiting:conflict'${batch ? ` AND row_index IN (${marks(batch.length)})` : ""}`,
			[answer === "keep" ? "kept" : "approved:conflict", id, ...(batch ?? [])],
		)
		decided += result.rowcount ?? 0
	}
	return decided
}

/** Persist every row's consent atomically with its next gate, including on per-title answers. */
export async function transitionWishlistQuestion(
	userId: string,
	id: string,
	question: "rewatch" | "wholeShow",
	answer: ImportAnswer,
	indexes: number[] | null,
	options: ImportOptions,
) {
	let decided = 0
	for (const item of await itemRows(userId, id)) {
		if (
			item.applyState !== `waiting:${question}` ||
			(indexes && !indexes.includes(item.index))
		)
			continue
		item.payload._answer = {
			...(item.payload._answer as object),
			[question]: answer,
		}
		if (answer !== "leave") item.applyState = `approved:${question}`
		const gate =
			answer === "leave"
				? { kept: true as const, question }
				: importGate(item, options)
		const keptQuestion = "kept" in gate ? gate.question : undefined
		const state =
			answer === "leave" || keptQuestion
				? "kept"
				: "hold" in gate
					? `waiting:${gate.hold}`
					: `approved:${question}`
		const result = await run(
			"UPDATE doc.user_import_item SET apply_state = ?, payload = ?, reason = ?, applied_at = CURRENT_TIMESTAMP WHERE import_id = ? AND row_index = ? AND apply_state = ?",
			[
				state,
				JSON.stringify(item.payload),
				answer === "leave"
					? QUESTION_KEPT_REASON[question]
					: keptQuestion
						? QUESTION_KEPT_REASON[keptQuestion]
						: item.reason,
				id,
				item.index,
				`waiting:${question}`,
			],
		)
		decided += result.rowcount ?? 0
	}
	return decided
}

/** Whole-question answers are durable before rows move, so repeating a decision repairs an interrupted request. */
export async function decideImport(
	userId: string,
	id: string,
	question: ImportQuestion,
	answer: ImportAnswer,
	rows?: number[],
) {
	if (
		(question !== "conflict" &&
			question !== "rewatch" &&
			question !== "wholeShow") ||
		!(question === "conflict" ? ["keep", "source"] : ["add", "leave"]).includes(
			answer,
		) ||
		(rows &&
			(rows.length === 0 ||
				rows.length > 500 ||
				rows.some((index) => !Number.isSafeInteger(index) || index < 0)))
	)
		throw new NativeImportError(400, "Choose a valid answer and import rows.")
	let row = await getImportRow(userId, id)
	const wasStalled = summarize(row).stalled
	const check = () => {
		const summary = summarize(row)
		if (
			summary.operation !== "apply" ||
			!["running", "done", "failed"].includes(row.status)
		)
			throw new NativeImportError(409, "This import cannot accept answers now.")
		if (!summary.options?.ask?.includes(question))
			throw new NativeImportError(
				400,
				"This question was not asked for this import.",
			)
	}
	check()
	if (!rows) {
		let saved = false
		for (let attempt = 0; attempt < 3; attempt++) {
			row = await getImportRow(userId, id)
			check()
			const options = JSON.parse(row.options ?? "null") as ImportOptions
			options.answers = { ...options.answers, [question]: answer }
			if (question === "conflict")
				options.conflictChoice = answer === "source" ? "source" : "keep"
			if (
				await claim(
					row,
					"options = ?, conflict_choice = ?, updated_at = CURRENT_TIMESTAMP",
					[JSON.stringify(options), options.conflictChoice],
				)
			) {
				saved = true
				break
			}
		}
		if (!saved)
			throw new NativeImportError(
				409,
				"The import changed. Try your answer again.",
			)
	}
	const indexes = rows ? [...new Set(rows)] : null
	const decided =
		question === "conflict"
			? await transitionConflict(id, answer, indexes)
			: await transitionWishlistQuestion(
					userId,
					id,
					question,
					answer,
					indexes,
					JSON.parse(row.options ?? "null") as ImportOptions,
				)
	// Publish row changes before touching the import version: a finisher that reads
	// this version must also see the approvals, including across different pods.
	await refreshItems()
	await run(
		"UPDATE doc.user_import SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		[id],
	)
	await recount(id)
	row = await getImportRow(userId, id)
	if (
		row.status === "done" ||
		row.status === "failed" ||
		(wasStalled && row.status === "running" && !activeRuns.has(id))
	) {
		const pending = await itemRows(userId, id, true)
		if (
			pending.some(
				(item) =>
					item.applyState == null || item.applyState?.startsWith("approved:"),
			)
		) {
			if (
				await claim(
					row,
					"status = 'running', options = ?, updated_at = CURRENT_TIMESTAMP, error = NULL",
					[row.options],
				)
			) {
				const options = JSON.parse(row.options ?? "null") as ImportOptions
				await holdQuestions(userId, id, options)
				void applyRun(userId, id, options)
			}
		}
	}
	captureProductEvent(
		userId,
		"import question answered",
		{ import_id: id, question, answer, decided },
		{
			uuid: eventUuid(
				`import-question:${userId}:${id}:${question}:${answer}:${indexes ? indexes.sort((a, b) => a - b).join(",") : "all"}`,
			),
		},
	)
	await refreshImports()
	const { getImport } = await import("./service.server.ts")
	return { import: await getImport(userId, id), decided }
}

async function applyRunStored(
	userId: string,
	id: string,
	initialOptions: ImportOptions,
) {
	if (activeRuns.has(id)) return
	activeRuns.add(id)
	let beat: NodeJS.Timeout | undefined
	let heartbeat: Promise<unknown> = Promise.resolve()
	try {
		while (true) {
			const options = JSON.parse(
				(await getImportRow(userId, id)).options ??
					JSON.stringify(initialOptions),
			) as ImportOptions
			// Repair an answer racing the confirm hold, or a crash after saving the answer.
			if (options.ask?.includes("conflict") && options.answers?.conflict) {
				await transitionConflict(id, options.answers.conflict, null)
				await refreshItems()
			}
			beat = setInterval(() => {
				heartbeat = heartbeat.then(() =>
					run(
						"UPDATE doc.user_import SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
						[id],
					).catch(() => null),
				)
			}, HEARTBEAT_MS)
			beat.unref()
			await holdQuestions(userId, id, options)
			for (const question of ["wholeShow", "rewatch"] as const) {
				const answer = options.answers?.[question]
				if (options.ask?.includes(question) && answer)
					await transitionWishlistQuestion(
						userId,
						id,
						question,
						answer,
						null,
						options,
					)
			}
			await refreshItems()
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
				let reason: string | undefined
				try {
					const gate = importGate(item, options)
					if ("hold" in gate) continue
					if ("kept" in gate) {
						state = "kept"
						if (gate.question) reason = QUESTION_KEPT_REASON[gate.question]
					} else if (
						isWant(item) &&
						item.wishlistRewatchChoice &&
						watchRefs.has(ref(item)) &&
						gate.effective.wishlistRewatch === true
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
					} else if (item.kind === "episode_rating")
						state = await applyImportedEpisodeScore(userId, id, item)
					else if (item.kind === "list") {
						const { applyImportedList } = await import(
							"./custom-list-apply.server.ts"
						)
						state = await applyImportedList(userId, id, item)
					} else if (isWant(item))
						state = await applySet(
							userId,
							id,
							item,
							"user_wishlist",
							gate.effective.wishlistRewatch === true,
						)
					else if (item.kind === "favorite")
						state = await applySet(userId, id, item, "user_favorite")
					// Watch rows are applied by the tracking phase below. Until a plan is available, leave them pending.
					else if (item.kind === "watch" || item.kind === "show_status")
						continue
				} catch {
					state = "failed"
				}
				tally[state]++
				await markItem(id, item, state, reason)
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
			// After the file's own watches: an episode this import scored is marked watched when no pass has a watch of it.
			const scoredEpisodes = (await itemRows(userId, id)).filter(
				(item) => item.kind === "episode_rating",
			)
			if (scoredEpisodes.length) {
				const { markImportedEpisodesWatched } = await import(
					"./episode-score-watches.server.ts"
				)
				await markImportedEpisodesWatched(
					userId,
					id,
					(await getImportRow(userId, id)).source as ImportSource,
					scoredEpisodes.map((item) => ({
						...item,
						applied:
							item.applyState === "added" || item.applyState === "updated",
					})),
				)
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
			await recount(id)
			clearInterval(beat)
			// Drain already-started heartbeat writes before reading the finishing version.
			await heartbeat
			// Read the version before checking pending: every decision touches this version.
			const finishing = await getImportRow(userId, id)
			await refreshItems()
			const left = await itemRows(userId, id, true)
			if (left.some((item) => item.applyState !== "failed")) continue
			const failed = left.length
			if (
				!(await claim(
					finishing,
					"status = ?, finished_at = COALESCE(finished_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP, error = ?",
					[
						failed ? "failed" : "done",
						failed
							? "Some rows could not be applied. Try again to finish the import."
							: null,
					],
				))
			)
				continue
			break
		}
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
		await heartbeat
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
				wishlistRewatch: stored.wishlistRewatch,
				...(stored.ask !== undefined ? { ask: stored.ask } : {}),
				...(stored.answers !== undefined ? { answers: stored.answers } : {}),
			}
		: options
	const response = () =>
		stored?.ask
			? import("./service.server.ts").then((service) =>
					service.getImport(userId, id),
				)
			: Promise.resolve(summarize(row))
	if (row.status === "done" || row.status === "undone") return response()
	if (row.status === "running" && !summarize(row).stalled) return response()
	if (!["preview", "failed", "running"].includes(row.status)) return response()
	const started = await claim(
		row,
		"status = 'running', options = ?, conflict_choice = ?, confirmed_at = COALESCE(confirmed_at,CURRENT_TIMESTAMP), finished_at = NULL, updated_at = CURRENT_TIMESTAMP, error = NULL",
		[
			JSON.stringify({ ...effectiveOptions, direction: "apply" }),
			effectiveOptions.conflictChoice,
		],
	)
	if (started) {
		await holdQuestions(userId, id, effectiveOptions)
		void applyRun(userId, id, effectiveOptions)
	}
	await refreshImports()
	return effectiveOptions.ask
		? (await import("./service.server.ts")).getImport(userId, id)
		: summarize(await getImportRow(userId, id))
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
	await run(
		"UPDATE doc.user_import_item SET apply_state = 'kept' WHERE import_id = ? AND (apply_state LIKE 'waiting:%' OR apply_state LIKE 'approved:%')",
		[id],
	)
	await refreshItems()
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
		// Newest first: the episode scores' watches were recorded after the file's own watches.
		const scoredEpisodes = items.filter(
			(item) => item.kind === "episode_rating",
		)
		if (scoredEpisodes.length) {
			const { undoImportedEpisodeWatches } = await import(
				"./episode-score-watches.server.ts"
			)
			await undoImportedEpisodeWatches(
				userId,
				id,
				scoredEpisodes.map((item) => ({ ...item, applied: true })),
			)
		}
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
			else if (item.kind === "episode_rating")
				outcome = await undoImportedEpisodeScore(userId, id, item)
			else if (item.kind === "list") {
				const { undoImportedList } = await import(
					"./custom-list-apply.server.ts"
				)
				outcome = await undoImportedList(userId, id, item)
			} else if (isWant(item) || item.kind === "favorite")
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
		if (
			(row.source === "wishlist" || row.source === "plex") &&
			items.some((item) => item.kind === "watch" || item.kind === "show_status")
		) {
			const { restoreAppliedImportIntentions } = await import(
				"./watch-items.server.ts"
			)
			await restoreAppliedImportIntentions(userId, id)
		}
		await run(
			"UPDATE doc.user_import_item SET apply_state = 'undone' WHERE import_id = ? AND apply_state IN ('added','updated')",
			[id],
		)
		// A per-row decision may have passed its status check before Undo claimed.
		await run(
			"UPDATE doc.user_import_item SET apply_state = 'kept' WHERE import_id = ? AND (apply_state LIKE 'waiting:%' OR apply_state LIKE 'approved:%')",
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

const localRuns = new Map<string, Promise<void>>()
async function applyRun(userId: string, id: string, options: ImportOptions) {
	// A decision can claim the next run after finishing CAS but before this pod exits the old run.
	const previous = localRuns.get(id)
	if (previous) {
		await previous
		const row = await getImportRow(userId, id)
		if (row.status !== "running" || summarize(row).operation !== "apply") return
	}
	const task = withProductContext(
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
	localRuns.set(id, task)
	try {
		await task
	} finally {
		if (localRuns.get(id) === task) localRuns.delete(id)
	}
}

export async function undoImport(userId: string, importId: string) {
	return withProductContext(
		{ origin: "undo", import_id: importId, batch_id: importId },
		() => undoImportStored(userId, importId),
	)
}
