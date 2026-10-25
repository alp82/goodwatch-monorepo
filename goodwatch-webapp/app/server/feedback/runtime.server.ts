import { correctionStore, isTrusted } from "./correction-runtime.server"
import { rateLimiter } from "~/server/rate-limit.server"
import { getCachedProfileByUserId } from "~/server/share-lists/view.server"
import { getUserFromRequest } from "~/utils/auth"
import { execute } from "~/utils/crate"
import { smtpTransport } from "../auth/mail.server"
import { handleFeedback } from "./handler.server"
import { feedbackMail } from "./mail.server"
import { createFeedbackStore } from "./store.server"

// The shared helper types only scalar bindings; node-crate also supports null and object parameters.
const run = execute as (
	sql: string,
	params: unknown[],
) => ReturnType<typeof execute>

export const feedbackStore = createFeedbackStore(run)
export function submit(request: Request) {
	let createdAt: number | undefined
	return handleFeedback(request, {
		corrections: correctionStore,
		isTrusted: (id) => isTrusted(id, createdAt),
		store: feedbackStore,
		limiter: rateLimiter,
		memberHandle: async (id) =>
			(await getCachedProfileByUserId(id))?.handle?.trim() || null,
		memberId: async (request) => {
			const user = await getUserFromRequest({ request, fresh: true })
			createdAt = user?.created_at ? Date.parse(user.created_at) : undefined
			return user?.id ?? null
		},
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
