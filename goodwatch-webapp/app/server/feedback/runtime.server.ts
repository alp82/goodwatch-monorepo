import { execute, query } from "~/utils/crate"
import { getUserIdFromRequest } from "~/utils/auth"
import { feedbackMail } from "./mail.server"
import { smtpTransport } from "../auth/mail.server"
import { handleFeedback, type FeedbackStore } from "./handler.server"

// The shared helper types only scalar bindings; node-crate also supports null and object parameters.
const run = execute as (
	sql: string,
	params: unknown[],
) => ReturnType<typeof execute>

export const feedbackStore: FeedbackStore = {
	async insert(r) {
		const result = await run(
			`INSERT INTO doc.feedback_report
   (id, kind, message, payload, metadata, member_id, status, screenshot, sender_email, created_at)
   VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
			[
				r.id,
				r.kind,
				r.message,
				r.data ?? null,
				r.metadata,
				r.memberId,
				r.screenshot ?? null,
				r.email ?? null,
				r.createdAt,
			],
		)
		return Number((result as { rowcount: number }).rowcount) === 1
	},
	async discordId(id, messageId, threadId) {
		await run(
			"UPDATE doc.feedback_report SET discord_message_id = ?, discord_thread_id = ? WHERE id = ?",
			[messageId, threadId, id],
		)
	},
	async screenshot(id) {
		const [row] = await query<{ screenshot: string }>(
			"SELECT screenshot FROM doc.feedback_report WHERE id = ?",
			[id],
		)
		return row?.screenshot ?? null
	},
}
export function submit(request: Request) {
	return handleFeedback(request, {
		store: feedbackStore,
		memberId: async (request) =>
			(await getUserIdFromRequest({ request, fresh: true })) ?? null,
		async email(r) {
			const transport = smtpTransport({
				user: process.env.AUTH_SMTP_USER,
				password: process.env.AUTH_SMTP_PASSWORD,
			})
			try {
				await transport.sendMail(feedbackMail(r))
			} finally {
				transport.close()
			}
		},
	})
}
