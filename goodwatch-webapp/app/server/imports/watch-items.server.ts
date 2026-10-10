import type { ImportItem, ImportOptions, ImportSource } from "~/domain/imports"
import { recount } from "./apply.server.ts"
import {
	getImportRow,
	itemRows,
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
}
const planKey = (item: ImportItem) => `state:${item.mediaType}:${item.tmdbId}`

async function plans(importId: string, userId: string) {
	const rows = await select<PlanRow>(
		"SELECT row_index, source_key, payload, apply_state FROM doc.user_import_item WHERE import_id = ? AND user_id = ? AND kind = 'state' LIMIT 100001",
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
		(item) => item.kind === "watch",
	)
	if (!pending.length) return
	const existingPlans = await plans(importId, userId)
	const groups = new Map<string, typeof pending>()
	for (const item of pending) {
		const key = planKey(item)
		groups.set(key, [...(groups.get(key) ?? []), item])
	}
	let nextIndex = Math.max(
		importRow.total,
		...[...existingPlans.values()].map((row) => Number(row.row_index) + 1),
	)
	for (const [key, items] of groups) {
		const first = items[0]
		if (!first || first.tmdbId === null)
			throw new Error("A matched watch is missing its title ID.")
		let stored = existingPlans.get(key)
		if (!stored) {
			const plan = await prepareImportTrackingPlan({
				userId,
				importId,
				source: importRow.source as ImportSource,
				tmdbId: first.tmdbId,
				mediaType: first.mediaType,
				items,
				watchDates: options.watchDates,
				now: Date.now(),
			})
			const rowIndex = nextIndex++
			// The title plan is the write-ahead journal. It must be durable before a watch or state row is changed.
			await run(
				"INSERT INTO doc.user_import_item (import_id,row_index,user_id,kind,source_key,payload,outcome,reason,tmdb_id,media_type) VALUES (?, ?, ?, 'state', ?, ?, 'new', NULL, ?, ?) ON CONFLICT (import_id,row_index) DO NOTHING",
				[
					importId,
					rowIndex,
					userId,
					key,
					JSON.stringify(plan),
					first.tmdbId,
					first.mediaType,
				],
			)
			await refreshItems()
			stored = (await plans(importId, userId)).get(key)
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
			const state = addedIds.has(importWatchId(importRow.source, item.key))
				? "added"
				: "kept"
			await run(
				"UPDATE doc.user_import_item SET apply_state = ?, watch_id = ?, applied_at = CURRENT_TIMESTAMP WHERE import_id = ? AND row_index = ? AND (apply_state IS NULL OR apply_state = 'failed')",
				[
					state,
					state === "added" ? importWatchId(importRow.source, item.key) : null,
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
) {
	await getImportRow(userId, importId)
	const stored = [...(await plans(importId, userId)).values()].filter(
		(row) => row.apply_state === "added",
	)
	for (const row of stored.reverse())
		await undoImportTrackingPlan(userId, row.plan)
	await run(
		"UPDATE doc.user_import_item SET apply_state = 'undone' WHERE import_id = ? AND user_id = ? AND kind IN ('watch','state') AND apply_state IN ('added','kept')",
		[importId, userId],
	)
}
