import { randomUUID } from "node:crypto"
import {
	correctionKey,
	flagArea,
	mapCorrection,
	type Correction,
	type CorrectionStatus,
} from "./corrections.ts"
import type { Report } from "./handler.server.ts"
export type Sql = (
	sql: string,
	params: unknown[],
) => Promise<{ rowcount: number; json?: unknown[] }>
type Versioned = Correction & { _version: number }
const decode = (r: Versioned): Versioned => ({
	...r,
	value: JSON.parse(String(r.value)),
	old_value: JSON.parse(String(r.old_value)),
})
export function createCorrectionStore(
	run: Sql,
	invalidate: (c: Correction) => Promise<void> = async () => {},
) {
	async function get(id: string) {
		await run("REFRESH TABLE doc.catalog_correction", [])
		const result = await run(
			"SELECT *, _version FROM doc.catalog_correction WHERE id = ?",
			[id],
		)
		return result.json?.[0] ? decode(result.json[0] as Versioned) : null
	}
	async function event(
		c: Correction,
		action: string,
		actor: string | null,
		details: unknown = {},
	) {
		await run(
			"INSERT INTO doc.catalog_correction_event (id, correction_id, action, actor, at, details) VALUES (?, ?, ?, ?, ?, ?)",
			[randomUUID(), c.id, action, actor, Date.now(), JSON.stringify(details)],
		)
	}
	async function lock<T>(c: Correction, work: () => Promise<T>): Promise<T> {
		// The reserved row is a mutex, never an effective correction or an active pointer.
		const id = `lock:${correctionKey(c)}`
		const claimed = await run(
			"INSERT INTO doc.catalog_correction (id, status) VALUES (?, 'withdrawn') ON CONFLICT (id) DO NOTHING",
			[id],
		)
		if (claimed.rowcount !== 1)
			throw new Error("Correction field is being reviewed")
		try {
			return await work()
		} finally {
			await run("DELETE FROM doc.catalog_correction WHERE id = ?", [id])
		}
	}
	async function liveConflict(c: Correction) {
		await run("REFRESH TABLE doc.catalog_correction", [])
		const found = await run(
			"SELECT id, target, field FROM doc.catalog_correction WHERE entity_kind = ? AND tmdb_id = ? AND status = 'live'",
			[c.entity_kind, c.tmdb_id],
		)
		return ((found.json as Correction[]) ?? []).some(
			(other) =>
				other.id !== c.id &&
				correctionKey({ ...c, ...other }) === correctionKey(c),
		)
	}
	async function response(reportId: string) {
		await run("REFRESH TABLE doc.feedback_report", [])
		const result = await run(
			"SELECT correction_id, payload FROM doc.feedback_report WHERE id = ?",
			[reportId],
		)
		const row = result.json?.[0] as
			| { correction_id?: string; payload?: Report["data"] }
			| undefined
		const c = row?.correction_id ? await get(row.correction_id) : null
		return {
			reportId,
			outcome:
				c?.status === "live"
					? ("live" as const)
					: flagArea(row?.payload?.area)
						? ("flag" as const)
						: ("pending" as const),
			correctionId: c?.id ?? null,
		}
	}
	return {
		get,
		response,
		async submit(report: Report, trusted: boolean) {
			const mapped = mapCorrection(report.data)
			if (!mapped) return null
			const { review, ...fields } = mapped
			const c: Correction = {
				...fields,
				id: report.id,
				status: "pending",
				member_id: report.memberId,
				reviewer: null,
				report_id: report.id,
				source_link: report.data?.sourceLink ?? null,
				created_at: report.createdAt,
				updated_at: report.createdAt,
			}
			// Probe the event table before accepting a correction during staged rollout.
			await run("SELECT id FROM doc.catalog_correction_event LIMIT 1", [])
			const columns = Object.keys(c)
			const encoded = {
				...c,
				value: JSON.stringify(c.value),
				old_value: JSON.stringify(c.old_value),
			}
			const inserted = await run(
				`INSERT INTO doc.catalog_correction (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")}) ON CONFLICT (id) DO NOTHING`,
				Object.values(encoded),
			)
			if (inserted.rowcount !== 1) return get(c.id)
			await event(c, "submitted", c.member_id)
			await run(
				"UPDATE doc.feedback_report SET correction_id = ? WHERE id = ?",
				[c.id, report.id],
			)
			if (trusted && !review) {
				try {
					await lock(c, async () => {
						if (await liveConflict(c)) return
						await event(c, "publish", c.member_id)
						const result = await run(
							"UPDATE doc.catalog_correction SET status = 'live', updated_at = ? WHERE id = ? AND status = 'pending'",
							[Date.now(), c.id],
						)
						if (result.rowcount === 1) c.status = "live"
					})
				} catch {
					/* A competing submission remains pending. */
				}
			}
			await run("REFRESH TABLE doc.catalog_correction", [])
			if (c.status === "live") {
				await run(
					"UPDATE doc.feedback_report SET status = 'done', updated_at = ? WHERE id = ?",
					[Date.now(), report.id],
				)
				await invalidate(c)
			}
			return c
		},
		async decide(
			id: string,
			action: "approve" | "reject" | "revert" | "undo",
			actor: string,
			own = false,
		) {
			const c = await get(id)
			if (!c) throw new Response(null, { status: 404 })
			if (own && c.member_id !== actor)
				throw new Response(null, { status: 403 })
			if (
				action === "approve" &&
				c.field === "offer" &&
				c.op === "add" &&
				!c.source_link
			)
				throw new Response(null, { status: 409 })
			const next: CorrectionStatus =
				action === "undo"
					? c.status === "live"
						? "reverted"
						: "withdrawn"
					: action === "approve"
						? "live"
						: action === "reject"
							? "rejected"
							: "reverted"
			if (
				(action === "approve" && c.status !== "pending") ||
				(action === "reject" &&
					c.status !== "pending" &&
					c.status !== "live") ||
				(action === "revert" && c.status !== "live") ||
				(action === "undo" && !["live", "pending"].includes(c.status))
			)
				throw new Response(null, { status: 409 })
			return lock(c, async () => {
				if (next === "live" && (await liveConflict(c)))
					throw new Response(null, { status: 409 })
				// Record the attempted decision before the conditional write. Only the winner records completion.
				await event(c, `${action}_requested`, actor, {
					from: c.status,
					to: next,
				})
				const updated = await run(
					"UPDATE doc.catalog_correction SET status = ?, reviewer = ?, updated_at = ? WHERE id = ? AND _version = ?",
					[next, own ? c.reviewer : actor, Date.now(), id, c._version],
				)
				if (updated.rowcount !== 1) throw new Response(null, { status: 409 })
				c.status = next
				await event(c, action, actor, { status: next })
				await run(
					"UPDATE doc.feedback_report SET status = ?, handled_by = ?, updated_at = ? WHERE id = ?",
					[
						next === "live" ? "done" : "wont_fix",
						actor,
						Date.now(),
						c.report_id,
					],
				)
				await run("REFRESH TABLE doc.catalog_correction", [])
				await invalidate(c)
				return c
			})
		},
	}
}
