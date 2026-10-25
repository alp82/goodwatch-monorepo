import type { FeedbackStore, Report, StoredReport } from "./handler.server.ts"
import { feedbackStatusSchema } from "./schema.ts"

type Sql = (
	sql: string,
	params: unknown[],
) => Promise<{ rowcount: number; json?: unknown[] }>
interface Candidate {
	id: string
	status: unknown
	duplicate_count: number
	discord_thread_id: string | null
	metadata: Record<string, unknown>
	_version: number
}

/** No database access until a method is called. SQL is injected for local tests. */
export function createFeedbackStore(run: Sql): FeedbackStore {
	return {
		async insert(r: Report): Promise<StoredReport> {
			if (r.dedupeKey) {
				// Crate search is eventually consistent. Refresh narrows the first-insert race;
				// _version prevents lost counts and merging into a concurrently closed report.
				for (let attempt = 0; attempt < 3; attempt++) {
					await run("REFRESH TABLE doc.feedback_report", [])
					const existing = await run(
						"SELECT id FROM doc.feedback_report WHERE id = ?",
						[r.id],
					)
					if (existing.json?.length) return { kind: "retry", reportId: r.id }
					const result = await run(
						`SELECT id, status, duplicate_count, discord_thread_id, metadata, _version
 FROM doc.feedback_report WHERE dedupe_key = ? ORDER BY created_at, id`,
						[r.dedupeKey],
					)
					const candidates = (result.json ?? []) as Candidate[]
					// Keep merged submission ids on the original row so network retries do not raise the count.
					for (const row of candidates) {
						const ids = row.metadata?.feedbackSubmissionIds
						if (Array.isArray(ids) && ids.includes(r.id))
							return {
								kind: "duplicate",
								reportId: row.id,
								count: row.duplicate_count,
								threadId: row.discord_thread_id,
								retry: true,
							}
					}
					// A status this build does not know (hand edited, or a newer deploy) counts as closed:
					// the report is stored as its own row instead of failing the request.
					const row = candidates.find((row) => {
						const status = feedbackStatusSchema.safeParse(row.status)
						return (
							status.success &&
							(status.data === "new" || status.data === "in_progress")
						)
					})
					if (!row) break
					const ids = row.metadata?.feedbackSubmissionIds
					const updated = await run(
						`UPDATE doc.feedback_report SET duplicate_count = duplicate_count + 1, updated_at = ?, metadata = ?
 WHERE id = ? AND _version = ?`,
						[
							r.createdAt,
							{
								...row.metadata,
								feedbackSubmissionIds: [
									...(Array.isArray(ids) ? ids : []),
									r.id,
								],
							},
							row.id,
							row._version,
						],
					)
					if (updated.rowcount === 1)
						return {
							kind: "duplicate",
							reportId: row.id,
							count: row.duplicate_count + 1,
							threadId: row.discord_thread_id,
							retry: false,
						}
					if (attempt === 2)
						throw new Error("Feedback changed during duplicate merge")
				}
			}
			const result = await run(
				`INSERT INTO doc.feedback_report
 (id, kind, message, payload, metadata, member_id, status, has_screenshot, sender_email, created_at,
 dedupe_key, duplicate_count, updated_at, handled_by)
 VALUES (?, ?, ?, ?, ?, ?, ?, false, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
				[
					r.id,
					r.kind,
					r.message,
					r.data ?? null,
					r.metadata,
					r.memberId,
					feedbackStatusSchema.parse(r.status),
					r.email ?? null,
					r.createdAt,
					r.dedupeKey,
					r.duplicateCount,
					r.updatedAt,
					r.handledBy,
				],
			)
			return { kind: result.rowcount === 1 ? "new" : "retry", reportId: r.id }
		},
		async storeScreenshot(id, screenshot) {
			await run(
				`INSERT INTO doc.feedback_screenshot (report_id, data, content_type, bytes, created_at)
 VALUES (?, ?, ?, ?, ?) ON CONFLICT (report_id) DO NOTHING`,
				[
					id,
					screenshot.data,
					screenshot.contentType,
					screenshot.bytes,
					screenshot.createdAt,
				],
			)
			await run(
				"UPDATE doc.feedback_report SET has_screenshot = true WHERE id = ?",
				[id],
			)
		},
		async discordId(id, messageId, threadId) {
			await run(
				"UPDATE doc.feedback_report SET discord_message_id = ?, discord_thread_id = ? WHERE id = ?",
				[messageId, threadId, id],
			)
		},
		async screenshot(id) {
			const result = await run(
				"SELECT data, content_type, bytes, created_at FROM doc.feedback_screenshot WHERE report_id = ?",
				[id],
			)
			const row = result.json?.[0] as
				| {
						data: string
						content_type: string
						bytes: number
						created_at: number
				  }
				| undefined
			return row
				? {
						data: row.data,
						contentType: row.content_type,
						bytes: row.bytes,
						createdAt: row.created_at,
					}
				: null
		},
	}
}
