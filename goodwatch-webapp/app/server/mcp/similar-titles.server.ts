import { relatedMapNeighbors } from "../related-map.server"
import { loadTaste } from "../taste/index.server"
import { getDisplayFields } from "../title-cards.server"
import { titleKey } from "../../utils/title-key"
import { type ViewerContext, getMemberViewerContext } from "../viewer.server"
import { resolve, summary } from "./data.server.ts"
import { similarTitleView } from "./similar-titles.ts"
import type { ReadArgs } from "./tools.server.ts"

export async function similarTitles(
	userId: string,
	origin: string,
	args: ReadArgs,
	guest?: ViewerContext,
) {
	const resolved = await resolve(args, origin)
	if ("result" in resolved) return resolved.result
	const source = resolved.title
	const [pack, ctx, taste] = await Promise.all([
		relatedMapNeighbors(source.media_type, source.tmdb_id),
		guest ?? getMemberViewerContext(userId, "US"),
		!guest && args.for_you !== false
			? loadTaste({ kind: "member", userId }).catch(() => null)
			: null,
	])
	const view = similarTitleView(
		pack?.n ?? [],
		source,
		args,
		ctx.hidden,
		[...ctx.seen, ...ctx.skipped],
		taste?.signal === "some" ? (keys) => taste.percentile(keys) : undefined,
	)
	// Guest reads serve the Discord list card, which shows posters, runtimes and scores. Member output is unchanged.
	const displays = guest
		? await getDisplayFields(
				view.items.map((title) => titleKey(title.media_type, title.tmdb_id)),
			).catch(() => null)
		: null
	return {
		...view,
		source: summary(source, origin),
		items: view.items.map((title) => {
			const display = displays?.get(titleKey(title.media_type, title.tmdb_id))
			return {
				...summary(title, origin),
				similarity: title.similarity,
				...(guest
					? {
							poster_url: display?.poster_path
								? `https://image.tmdb.org/t/p/w342${display.poster_path}`
								: null,
							runtime_minutes: display?.runtime ?? null,
							goodwatch_score:
								display?.goodwatch_overall_score_normalized_percent ?? null,
						}
					: {}),
			}
		}),
		similarity_note:
			"Fingerprint similarity to the source title (0–1), separate from your GoodWatch taste match.",
		candidate_limit: 80,
		...(!pack
			? {
					message:
						"No title analysis fingerprint neighbors are available for this title.",
				}
			: {}),
	}
}
