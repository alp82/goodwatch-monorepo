import { failedMediaResult, mediaReadFailed } from "./media-read-health.server.ts"

/** A later category page needs results. A failed read does not prove the page is absent. */
export function requireCategoryPage(page: number, results: readonly unknown[]) {
	if (
		page > 1 &&
		results.length === 0 &&
		!mediaReadFailed() &&
		!failedMediaResult(results)
	)
		throw new Response("Not Found", { status: 404 })
}
