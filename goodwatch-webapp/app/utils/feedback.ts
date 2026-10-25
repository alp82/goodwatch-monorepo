export interface FeedbackTarget {
	personId?: number
	creditTmdbId?: number
	creditMediaType?: "movie" | "tv"
	seasonNumber?: number
	episodeNumber?: number
	providerId?: number
	offerType?: "flatrate" | "free" | "ads" | "rent" | "buy"
	country?: string
	scoreSource?: string
}

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
		/** The title or person name as the page shows it. */
		entityName?: string
		ids: Record<string, string | number>
		field: string
		currentValue?: string | number | boolean | null
		suggestedValue?: string | number | boolean | null
		sourceLink?: string
		country?: string
		providerIds?: number[]
		/** The page part, e.g. `watch`, `cast` (docs/implementation/feedback/fix-mode-contract.md). */
		area?: string
		/** The picked problem's id, `other` for "Something else". */
		problem?: string
		/** What the problem points at; only the keys the problem needs. */
		target?: FeedbackTarget
		/** Free text: "Something else", "What looks off?", or typed answers. */
		note?: string
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
/** What a fix mode report did: applied now, waiting for staff, or a flag staff look at. */
export type FeedbackOutcome = "live" | "pending" | "flag"

/** The endpoint's answer. `outcome` and `correctionId` come with the corrections layer; older servers send neither. */
export interface FeedbackResponse {
	reportId: string
	outcome?: FeedbackOutcome
	correctionId?: string | null
}

/** The outcome to show: the server's, else `fallback` (what the report can be at most without a correction). */
export function outcomeOf(
	response: Partial<FeedbackResponse> | null | undefined,
	fallback: Exclude<FeedbackOutcome, "live">,
): { outcome: FeedbackOutcome; correctionId: string | null } {
	const outcome = response?.outcome
	if (outcome === "live" || outcome === "pending" || outcome === "flag")
		return {
			outcome,
			correctionId:
				typeof response?.correctionId === "string" && response.correctionId
					? response.correctionId
					: null,
		}
	return { outcome: fallback, correctionId: null }
}

/** Takes back the member's own live or pending correction. */
export async function undoCorrection(
	correctionId: string,
): Promise<{ status: "reverted" | "withdrawn" }> {
	let response: Response
	try {
		response = await fetch(
			`/api/feedback/corrections/${encodeURIComponent(correctionId)}/undo`,
			{ method: "POST", credentials: "same-origin" },
		)
	} catch {
		throw new FeedbackError(0)
	}
	if (!response.ok) throw new FeedbackError(response.status)
	return response.json()
}

export async function submitFeedback(
	report: FeedbackRequest,
): Promise<FeedbackResponse> {
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
