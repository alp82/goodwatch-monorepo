/** Keep idempotencyKey unchanged when retrying. startedAt is when the form opened (epoch ms). */
export interface FeedbackRequest {
	kind: "bug" | "idea" | "data" | "contact"
	message: string
	email?: string
	idempotencyKey: string
	website: string
	startedAt: number
	data?: {
		entityKind: "movie" | "show" | "season" | "episode" | "person"
		ids: Record<string, string | number>
		field: string
		currentValue?: string | number | boolean | null
		suggestedValue?: string | number | boolean | null
		sourceLink?: string
		country?: string
		providerIds?: number[]
	}
	metadata?: {
		url?: string
		routeId?: string
		viewport?: { width: number; height: number }
		dpr?: number
		locale?: string
		colorScheme?: "light" | "dark"
		time?: string
		sentryReplayId?: string
	}
	/** Raw base64 (no data URL), PNG, WebP or JPEG, at most 2 MiB decoded. */
	screenshot?: string
}
/** A refusal from the endpoint; status is 0 when the request never got an answer. */
export class FeedbackError extends Error {
	readonly status: number
	constructor(status: number) {
		super(`Feedback submission failed (${status})`)
		this.name = "FeedbackError"
		this.status = status
	}
}
export async function submitFeedback(
	report: FeedbackRequest,
): Promise<{ reportId: string }> {
	let response: Response
	try {
		response = await fetch("/api/feedback", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(report),
		})
	} catch {
		throw new FeedbackError(0)
	}
	if (!response.ok) throw new FeedbackError(response.status)
	return response.json()
}
