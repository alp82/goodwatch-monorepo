import "node-crate"
import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { afterEach, test } from "node:test"
import type { ImportOptions } from "../../domain/imports.ts"
import type { Param } from "./store.server.ts"

const callbacks = globalThis as typeof globalThis & {
	watchApply?: (
		plan: Record<string, unknown>,
		checkpoint?: (plan: Record<string, unknown>) => Promise<void>,
	) => Promise<{ added: number; kept: number; watchIds: string[] }>
	watchUndo?: (plan: Record<string, unknown>) => Promise<void>
}

type Resolved = { url: string }
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		load(
			url: string,
			context: unknown,
			next: (url: string, context: unknown) => unknown,
		): unknown
	}): void
}
registerHooks({
	load(url, context, next) {
		if (url.endsWith("/imports/tracking.server.ts"))
			return {
				format: "module",
				source: `
				export const importWatchId = (_source, key) => "i:" + key;
				export const prepareImportTrackingPlan = async (input) => ({ userId: input.userId, importId: input.importId, title: { mediaType: input.mediaType, tmdbId: input.tmdbId }, watches: [{}], addedKeys: input.items.map(x => x.key), keptKeys: [] });
				export const applyImportTrackingPlan = async (_userId, plan, checkpoint) => globalThis.watchApply(plan, checkpoint);
				export const undoImportTrackingPlan = async (_userId, plan) => globalThis.watchUndo(plan);
			`,
				shortCircuit: true,
			}
		if (url.endsWith("/imports/apply.server.ts"))
			return {
				format: "module",
				source: "export const recount = async () => ({})",
				shortCircuit: true,
			}
		return next(url, context)
	},
})

const { setImportDbForTest } = await import("./store.server.ts")
const { applyPendingImportWatches, undoAppliedImportWatches } = await import(
	"./watch-items.server.ts"
)

type Row = Record<string, unknown>
function requiredRow(row: Row | undefined): Row {
	if (!row) throw new Error("Expected the fake journal row to exist.")
	return row
}
class WatchDb {
	items: Row[] = [
		{
			import_id: "11111111-1111-4111-8111-111111111111",
			row_index: 0,
			user_id: "member",
			kind: "watch",
			source_key: "watch:one",
			payload: JSON.stringify({
				key: "watch:one",
				kind: "watch",
				mediaType: "movie",
				title: "One",
				year: 2024,
				tmdbId: 42,
				imdbId: null,
				index: 0,
				outcome: "new",
				reason: null,
			}),
			outcome: "new",
			reason: null,
			tmdb_id: 42,
			media_type: "movie",
			current_score: null,
			apply_state: null,
		},
	]
	failObservationOnce = true
	seq = 1
	async select<T extends {}>(sql: string, params: Param[]): Promise<T[]> {
		if (sql.includes("FROM doc.user_import WHERE id = ?"))
			return [
				{
					id: params[0],
					user_id: "member",
					source: "letterboxd",
					status: "running",
					file_name: "export.zip",
					counts: "{}",
					processed: 0,
					total: 1,
					added: 0,
					updated: 0,
					kept: 0,
					failed: 0,
					error: null,
					created_at: new Date(),
					updated_at: new Date(),
					confirmed_at: new Date(),
					finished_at: null,
					options: null,
					warnings: "[]",
					kinds: "{}",
					read_at: new Date(),
					_seq_no: this.seq,
					_primary_term: 1,
				},
			] as unknown as T[]
		if (sql.includes("FROM doc.user_import_item")) {
			let rows = this.items.filter(
				(row) => row.import_id === params[0] && row.user_id === params[1],
			)
			if (sql.includes("kind = 'state'"))
				rows = rows.filter((row) => row.kind === "state")
			if (sql.includes("kind <> 'state'"))
				rows = rows.filter((row) => row.kind !== "state")
			if (sql.includes("apply_state IS NULL OR apply_state = 'failed'"))
				rows = rows.filter(
					(row) => row.apply_state == null || row.apply_state === "failed",
				)
			return rows.map((row) => ({ ...row })) as T[]
		}
		throw new Error(`Unexpected select: ${sql}`)
	}
	async run(sql: string, params: Param[]) {
		if (sql.startsWith("REFRESH TABLE")) return { rowcount: 1 }
		if (sql.startsWith("INSERT INTO doc.user_import_item")) {
			this.items.push({
				import_id: params[0],
				row_index: params[1],
				user_id: params[2],
				kind: "state",
				source_key: params[3],
				payload: params[4],
				outcome: "new",
				reason: null,
				tmdb_id: params[5],
				media_type: params[6],
				apply_state: null,
			})
			return { rowcount: 1 }
		}
		if (sql.includes("SET payload = ?")) {
			const row = requiredRow(
				this.items.find(
					(item) =>
						item.import_id === params[1] && item.row_index === params[2],
				),
			)
			row.payload = params[0]
			return { rowcount: 1 }
		}
		if (sql.includes("SET apply_state = 'added'")) {
			const row = requiredRow(
				this.items.find(
					(item) =>
						item.import_id === params[0] && item.row_index === params[1],
				),
			)
			if (row.apply_state == null) row.apply_state = "added"
			return { rowcount: 1 }
		}
		if (sql.includes("SET apply_state = ?")) {
			if (this.failObservationOnce) {
				this.failObservationOnce = false
				throw new Error("crash after plan receipt")
			}
			const row = requiredRow(
				this.items.find(
					(item) =>
						item.import_id === params[2] && item.row_index === params[3],
				),
			)
			row.apply_state = params[0]
			row.watch_id = params[1]
			return { rowcount: 1 }
		}
		if (sql.includes("SET apply_state = 'undone'")) {
			for (const row of this.items)
				if (
					row.import_id === params[0] &&
					["watch", "state"].includes(String(row.kind)) &&
					["added", "kept"].includes(String(row.apply_state))
				)
					row.apply_state = "undone"
			return { rowcount: 2 }
		}
		throw new Error(`Unexpected run: ${sql}`)
	}
}

afterEach(() => {
	setImportDbForTest()
	callbacks.watchApply = undefined
	callbacks.watchUndo = undefined
})

test("a crash after applying watches leaves the plan durable for resume and undo", async () => {
	const db = new WatchDb()
	setImportDbForTest(db)
	callbacks.watchApply = async (plan, checkpoint) => {
		await checkpoint?.({ ...plan, checkpointed: true })
		return { added: 1, kept: 0, watchIds: ["i:watch:one"] }
	}
	let undone = 0
	callbacks.watchUndo = async (plan) => {
		assert.equal(plan.checkpointed, true)
		undone++
	}
	const options: ImportOptions = {
		kinds: ["watch"],
		conflictChoice: "source",
		watchDates: "preserve",
	}

	await assert.rejects(
		() =>
			applyPendingImportWatches(
				"member",
				String(db.items[0].import_id),
				options,
			),
		/crash after plan receipt/,
	)
	assert.equal(
		db.items.find((row) => row.kind === "state")?.apply_state,
		"added",
		"the plan receipt lands before the observation completion",
	)
	assert.equal(db.items[0].apply_state, null)

	await applyPendingImportWatches(
		"member",
		String(db.items[0].import_id),
		options,
	)
	assert.equal(db.items[0].apply_state, "added")
	await undoAppliedImportWatches("member", String(db.items[0].import_id))
	assert.equal(undone, 1)
	assert.deepEqual(
		db.items.map((row) => row.apply_state),
		["undone", "undone"],
	)
})
