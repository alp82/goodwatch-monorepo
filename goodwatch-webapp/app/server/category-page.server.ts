import { notFound } from "~/ui/explore/address"
import { failedMediaResult, mediaReadFailed } from "./media-read-health.server.ts"

/** A later guest category page needs results. Member exclusions can empty an existing page. A failed read does not prove the page is absent. */
export function requireCategoryPage(
	page: number,
	results: readonly unknown[],
	userId?: string | null,
) {
	if (
		!userId &&
		page > 1 &&
		results.length === 0 &&
		!mediaReadFailed() &&
		!failedMediaResult(results)
	)
		throw notFound()
}
