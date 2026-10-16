import type { ViewerContext } from "~/server/viewer.server"
import type { TitleKey } from "~/utils/title-key"

/**
 * Whether a title can still be a recommendation for the person: not rated, not in any watch state (Watching, On
 * hold, Dropped, Seen), not marked Not interested, and not passed in the taste quiz.
 */
export function recommendable(
	ctx: Pick<ViewerContext, "seen" | "ratings" | "hidden" | "skipped">,
	key: TitleKey,
): boolean {
	return !(
		ctx.seen.has(key) ||
		ctx.ratings.has(key) ||
		ctx.hidden.has(key) ||
		ctx.skipped.has(key)
	)
}
