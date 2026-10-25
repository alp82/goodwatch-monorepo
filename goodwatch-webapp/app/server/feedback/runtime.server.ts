import { rateLimiter } from "~/server/rate-limit.server"
import { getUserIdFromRequest } from "~/utils/auth"
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
	return handleFeedback(request, {
		store: feedbackStore,
		limiter: rateLimiter,
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
