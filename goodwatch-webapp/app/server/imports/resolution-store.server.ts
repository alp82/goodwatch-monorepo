import type { ImportItem } from "../../domain/imports.ts"
import type {
	ResolutionContext,
	ResolutionStore,
} from "./resolution-job.server.ts"
import { refreshItems, run, select } from "./store.server.ts"
function location(key: string): [string, number] {
	return key.startsWith("job/") ? [key.slice(4), -1] : [`resolution:${key}`, -1]
}
export const resolutionStore: ResolutionStore = {
	async read(key) {
		const [id, index] = location(key)
		const row = (
			await select<{ payload: string; _seq_no: number; _primary_term: number }>(
				"SELECT payload, _seq_no, _primary_term FROM doc.user_import_item WHERE import_id = ? AND row_index = ? AND kind = 'resolution'",
				[id, index],
			)
		)[0]
		return row
			? {
					value: JSON.parse(row.payload),
					version: `${row._seq_no}:${row._primary_term}`,
				}
			: null
	},
	async cas(key, version, value) {
		const [id, index] = location(key)
		const payload = JSON.stringify(value)
		if (Buffer.byteLength(payload) > 2 * 1024 * 1024)
			throw Error("Resolution checkpoint is too large")
		// Crate OCC writes allow only the full primary key and version predicates.
		// read() checks kind; its version fences any subsequent change to that row.
		const result =
			version === null
				? await run(
						"INSERT INTO doc.user_import_item (import_id,row_index,user_id,kind,source_key,payload,outcome) VALUES (?, ?, ?, 'resolution', ?, ?, 'unsupported') ON CONFLICT (import_id,row_index) DO NOTHING",
						[id, index, "resolution", key, payload],
					)
				: await run(
						"UPDATE doc.user_import_item SET payload = ? WHERE import_id = ? AND row_index = ? AND _seq_no = ? AND _primary_term = ?",
						[payload, id, index, ...String(version).split(":").map(Number)],
					)
		return result.rowcount === 1
	},
	async preview(member, id) {
		const row = (
			await select<{ status: string; user_id: string }>(
				"SELECT status, user_id FROM doc.user_import WHERE id = ?",
				[id],
			)
		)[0]
		return row?.user_id === member && row.status === "preview"
	},
}
export async function resolutionSourcePage(
	member: string,
	id: string,
	after: number,
) {
	return (
		await select<{ row_index: number; payload: string }>(
			"SELECT row_index, payload FROM doc.user_import_item WHERE import_id = ? AND user_id = ? AND row_index > ? AND kind NOT IN ('state','resolution') ORDER BY row_index LIMIT 200",
			[id, member, after],
		)
	).map((r) => ({
		...(JSON.parse(r.payload) as ImportItem),
		index: Number(r.row_index),
	}))
}
export async function resolutionRecordsPage(
	prefix: string,
	after = "",
	limit: 4 | 200 = 200,
) {
	return select<{ source_key: string; payload: string }>(
		`SELECT source_key, payload FROM doc.user_import_item WHERE import_id LIKE ? AND source_key > ? AND kind = 'resolution' ORDER BY source_key LIMIT ${limit}`,
		[`resolution:${prefix}%`, after],
	)
}
export const refreshResolution = refreshItems

/** Immutable lookup receipts: one bounded insert batch per checkpoint, never per HTTP request. */
export async function flushResolutionCache(
	ctx: ResolutionContext,
	entries: [string, unknown][],
) {
	for (let offset = 0; offset < entries.length; offset += 50) {
		const batch = entries.slice(offset, offset + 50)
		const params = batch.flatMap(([key, value]) => {
			const payload = JSON.stringify(value)
			if (Buffer.byteLength(payload) > 2 * 1024 * 1024)
				throw Error("Resolution checkpoint is too large")
			return [
				`resolution:${key}`,
				-1,
				"resolution",
				"resolution",
				key,
				payload,
				"unsupported",
			]
		})
		await ctx.check()
		await run(
			`INSERT INTO doc.user_import_item (import_id,row_index,user_id,kind,source_key,payload,outcome) VALUES ${batch.map(() => "(?,?,?,?,?,?,?)").join(",")} ON CONFLICT (import_id,row_index) DO NOTHING`,
			params,
		)
	}
}
