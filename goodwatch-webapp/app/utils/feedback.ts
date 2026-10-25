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
export async function submitFeedback(
	report: FeedbackRequest,
): Promise<{ reportId: string }> {
	const response = await fetch("/api/feedback", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(report),
	})
	if (!response.ok)
		throw new Error(`Feedback submission failed (${response.status})`)
	return response.json()
}
