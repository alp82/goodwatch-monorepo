import { readProfileCatalog } from "~/server/profile/catalog.server"
import { recommendationExcerptContext } from "./index.server"
import { excerptKeys, readRecommendationExcerpts } from "./excerpts"

export async function loadRecommendationExcerpts(
	userId: string,
	trope: string,
	keys: string[],
) {
	const context = await recommendationExcerptContext(userId, trope)
	if (context.pending || !context.index) return { pending: true, examples: [] }
	const visible = excerptKeys(context.index, context.excluded, trope, keys)
	return {
		pending: false,
		examples: await readRecommendationExcerpts(
			readProfileCatalog,
			context.index,
			trope,
			visible,
		),
	}
}
