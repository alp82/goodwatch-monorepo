import {
	BackendTimeoutError,
	withBackendTimeout,
} from "../utils/backend-timeout.ts"

// Bound a whole page dependency, including Redis, SQL and presentation. A query timeout alone does not bound
// a chain of reads. Shared cache fills keep their existing backend deadlines so a retry can use their result;
// abandoning one document must not cancel work another request joined.
export const TITLE_DETAILS_BUDGET_MS = 3000
export const TITLE_EPISODES_BUDGET_MS = 1000

export async function titleDetailsWithin<T>(
	work: Promise<T>,
	budgetMs = TITLE_DETAILS_BUDGET_MS,
): Promise<T> {
	try {
		return await withBackendTimeout("Title details", budgetMs, () => work)
	} catch (error) {
		if (!(error instanceof BackendTimeoutError)) throw error
		throw new Response(
			"Title temporarily unavailable. Please try again shortly.",
			{
				status: 503,
				headers: { "Cache-Control": "private, no-store", "Retry-After": "5" },
			},
		)
	}
}

export async function optionalTitlePart<T>(
	part: string,
	read: () => Promise<T>,
	budgetMs: number,
): Promise<{ complete: true; value: T } | { complete: false; value: null }> {
	try {
		const value = await withBackendTimeout(`Title ${part}`, budgetMs, read)
		return { complete: true, value }
	} catch (error) {
		console.warn("Title page part unavailable", {
			part,
			budgetMs,
			error: error instanceof Error ? error.name : "UnknownError",
		})
		return { complete: false, value: null }
	}
}
