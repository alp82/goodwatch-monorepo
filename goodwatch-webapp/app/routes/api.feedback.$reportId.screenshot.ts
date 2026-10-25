import type { LoaderFunctionArgs } from "@remix-run/node"
import { getUserIdFromRequest } from "~/utils/auth"
import { readScreenshot } from "~/server/feedback/handler.server"
import { feedbackStore } from "~/server/feedback/runtime.server"
export async function loader({ request, params }: LoaderFunctionArgs) {
	const memberId = await getUserIdFromRequest({ request, fresh: true })
	// Explicit server-owned allowlist; no role or email from the submitted body is trusted.
	const staffIds = (process.env.FEEDBACK_STAFF_MEMBER_IDS ?? "")
		.split(",")
		.map((id) => id.trim())
		.filter(Boolean)
	return readScreenshot(
		params.reportId ?? "",
		Boolean(memberId && staffIds.includes(memberId)),
		feedbackStore,
	)
}
