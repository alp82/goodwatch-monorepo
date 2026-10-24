import type { StoredUndoOutcome } from "~/domain/import-result"
import type { ImportItem, ImportOptions, ImportSource } from "~/domain/imports"
import { recount } from "./apply.server.ts"
import {
	getImportRow,
	itemRows,
	recordUndo,
	refreshItems,
	run,
	select,
} from "./store.server.ts"
import {
	type ImportTrackingPlan,
	applyImportTrackingPlan,
	importWatchId,
	prepareImportTrackingPlan,
	undoImportTrackingPlan,
} from "./tracking.server.ts"

type PlanRow = {
	row_index: number
	source_key: string
	payload: string
	apply_state: string | null
	undo_outcome: StoredUndoOutcome | null
}
const planKey = (item: ImportItem) => `state:${item.mediaType}:${item.tmdbId}`

async function plans(importId: string, userId: string) {
	const rows = await select<PlanRow>(
		"SELECT row_index, source_key, payload, apply_state, undo_outcome FROM doc.user_import_item WHERE import_id = ? AND user_id = ? AND kind = 'state' ORDER BY row_index LIMIT 100001",
		[importId, userId],
	)
	return new Map(
		rows.map((row) => [
			row.source_key,
			{ ...row, plan: JSON.parse(row.payload) as ImportTrackingPlan },
		]),
	)
}

export async function applyPendingImportWatches(
	userId: string,
	importId: string,
	options: ImportOptions,
) {
	const importRow = await getImportRow(userId, importId)
	const pending = (await itemRows(userId, importId, true)).filter(
		(item) => item.kind === "watch" || item.kind === "show_status",
	)
	if (!pending.length) return
	const existingPlans = await plans(importId, userId)
	const scorePlans = options.ask?.includes("undated")
		? (await itemRows(userId, importId)).flatMap((item) => {
				const journal = item.payload.scoreWatch as
					| { plan: ImportTrackingPlan }
					| undefined
				return journal ? [journal.plan] : []
			})
		: []
	const groups = new Map<string, typeof pending>()
	for (const item of pending) {
		const key = planKey(item)
		groups.set(key, [...(groups.get(key) ?? []), item])
	}
	let nextIndex = Math.max(
		importRow.total,
		...[...existingPlans.values()].map((row) => Number(row.row_index) + 1),
	)
	for (const [key, groupItems] of groups) {
		let items = groupItems
		const first = items[0]
		if (!first || first.tmdbId === null)
			throw new Error("A matched watch is missing its title ID.")
		// An applied plan can still own pending observations after a crash. Reuse it only
		// for its own keys; newly approved watches need a fresh snapshot of the live log/state.
		const titlePlans = [...existingPlans.entries()].filter(
			([k]) => k === key || k.startsWith(`${key}#`),
		)
		const coveredBy = (row: (typeof titlePlans)[number][1]) =>
			items.some(
				(item) =>
					row.plan.addedKeys.includes(item.key) ||
					row.plan.keptKeys.includes(item.key) ||
					row.plan.statusItem?.key === item.key,
			)
		let stored = options.ask?.includes("undated")
			? titlePlans.find(
					([, row]) => row.apply_state !== "added" || coveredBy(row),
				)?.[1]
			: existingPlans.get(key)
		if (options.ask?.includes("undated") && stored) {
			const owned = new Set([
				...stored.plan.addedKeys,
				...stored.plan.keptKeys,
				...(stored.plan.statusItem ? [stored.plan.statusItem.key] : []),
			])
			items = items.filter((item) => owned.has(item.key))
		}
		const journalKey =
			!stored && options.ask?.includes("undated") && titlePlans.length
				? `${key}#${titlePlans.length + 1}`
				: key
		if (!stored) {
			const plan = await prepareImportTrackingPlan({
				userId,
				importId,
				source: importRow.source as ImportSource,
				tmdbId: first.tmdbId,
				mediaType: first.mediaType,
				items,
				...(options.ask?.includes("undated")
					? {
							priorPlans: [
								...titlePlans
									.filter(([, row]) => row.apply_state === "added")
									.map(([, row]) => row.plan),
								...scorePlans.filter(
									(plan) =>
										plan.title.mediaType === first.mediaType &&
										plan.title.tmdbId === first.tmdbId,
								),
							].sort((a, b) => a.now - b.now),
						}
					: {}),
				watchDates: options.watchDates,
				now: options.ask?.includes("undated")
					? Math.max(
							Date.now(),
							...titlePlans.map(([, row]) => row.plan.now + 1),
							...scorePlans.map((plan) => plan.now + 1),
						)
					: Date.now(),
			})
			const rowIndex = nextIndex++
			// The title plan is the write-ahead journal. It must be durable before a watch or state row is changed.
			await run(
				"INSERT INTO doc.user_import_item (import_id,row_index,user_id,kind,source_key,payload,outcome,reason,tmdb_id,media_type) VALUES (?, ?, ?, 'state', ?, ?, 'new', NULL, ?, ?) ON CONFLICT (import_id,row_index) DO NOTHING",
				[
					importId,
					rowIndex,
					userId,
					journalKey,
					JSON.stringify(plan),
					first.tmdbId,
					first.mediaType,
				],
			)
			await refreshItems()
			stored = (await plans(importId, userId)).get(journalKey)
			if (!stored)
				throw new Error("The import watch plan could not be journaled.")
		}
		const journal = stored
		const result = await applyImportTrackingPlan(
			userId,
			journal.plan,
			async (updatedPlan) => {
				// A state CAS retry may observe another import's state. Replace the durable before/after snapshot before
				// the helper attempts that write, so undo always compares with the state transition that actually landed.
				await run(
					"UPDATE doc.user_import_item SET payload = ? WHERE import_id = ? AND row_index = ?",
					[JSON.stringify(updatedPlan), importId, journal.row_index],
				)
				journal.plan = updatedPlan
			},
		)
		// Commit the undo receipt before completing any observation. Otherwise a crash after the last
		// observation could leave no pending rows to resume and an invisible, unfinished undo plan.
		await run(
			"UPDATE doc.user_import_item SET apply_state = 'added', applied_at = CURRENT_TIMESTAMP WHERE import_id = ? AND row_index = ? AND apply_state IS NULL",
			[importId, journal.row_index],
		)
		const addedIds = new Set(result.watchIds)
		for (const item of items) {
			const state =
				result.statusKeys.includes(item.key) ||
				addedIds.has(importWatchId(importRow.source, item.key))
					? "added"
					: "kept"
			await run(
				"UPDATE doc.user_import_item SET apply_state = ?, watch_id = ?, applied_at = CURRENT_TIMESTAMP WHERE import_id = ? AND row_index = ? AND (apply_state IS NULL OR apply_state = 'failed' OR apply_state LIKE 'approved:%')",
				[
					state,
					state === "added" && item.kind === "watch"
						? importWatchId(importRow.source, item.key)
						: null,
					importId,
					item.index,
				],
			)
		}
		await recount(importId)
	}
}

export async function undoAppliedImportWatches(
	userId: string,
	importId: string,
	beforePlan?: (now: number) => Promise<void>,
) {
	await getImportRow(userId, importId)
	const stored = [...(await plans(importId, userId)).values()].filter(
		(row) =>
			row.apply_state === "added" &&
			(!row.undo_outcome || row.undo_outcome === "reverting"),
	)
	for (const row of stored.reverse()) {
		await beforePlan?.(row.plan.now)
		const resumed = row.undo_outcome === "reverting"
		await recordUndo(importId, Number(row.row_index), "reverting")
		await recordUndo(
			importId,
			Number(row.row_index),
			await undoImportTrackingPlan(userId, row.plan, resumed),
		)
	}
	await run(
		"UPDATE doc.user_import_item SET apply_state = 'undone' WHERE import_id = ? AND user_id = ? AND kind IN ('watch','state') AND apply_state IN ('added','kept')",
		[importId, userId],
	)
}

export async function restoreAppliedImportIntentions(
	userId: string,
	importId: string,
) {
	const { restoreImportTrackingIntentions } = await import(
		"./tracking.server.ts"
	)
	for (const row of (await plans(importId, userId)).values()) {
		if (!row.plan.restoreIntentions || row.undo_outcome !== "reverted") continue
		await restoreImportTrackingIntentions(userId, row.plan, async (plan) => {
			await run(
				"UPDATE doc.user_import_item SET payload = ? WHERE import_id = ? AND row_index = ?",
				[JSON.stringify(plan), importId, row.row_index],
			)
		})
	}
}
