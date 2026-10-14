// The pool: the titles the start page's TV draws its own picks from, read at the first interaction
// (ui/living-room/tv/use-tv-pool.ts). The best six and three per mood for the person, as cards; a member's saved
// services by name; and mini Discover's tile pictures, the same for everyone.
import { loadTaste } from "~/server/taste/index.server"
import {
	MAX_KEYS,
	type TitleCard,
	getDisplayFields,
	getServiceCards,
	getTitleCards,
} from "~/server/title-cards.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import type { ViewerContext } from "~/server/viewer.server"
import { LivingRoomUnavailable, rankOf } from "./picks.server"
import { poolCandidates, selectPoolKeys } from "./pool-keys.server"
import { type ChoiceArt, loadChoiceArt } from "./tv-choice-art.server"

export type LivingRoomPool = {
	member: boolean
	/** Best first for the person. */
	suggestions: TitleCard[]
	/** A member's saved services, by name. Empty for a guest. */
	savedServices: string[]
	choiceArt: ChoiceArt
}

export async function getLivingRoomPool(
	ctx: ViewerContext,
): Promise<LivingRoomPool> {
	const snapshot = getTitleSnapshot()
	if (!snapshot)
		throw new LivingRoomUnavailable("The title snapshot is loading")
	const taste = await loadTaste(ctx.viewer)
	const member = ctx.viewer.kind === "member"

	// The best few for any mood, then a few per mood, without repeats. The candidates are kept per snapshot version and
	// UTC day. The viewer's seen, skipped, and Want to See titles and their taste order apply on every request (see
	// pool-keys.server.ts).
	const today = Math.floor(Date.now() / 86_400_000)
	const candidates = poolCandidates(snapshot, today)
	const { keys } = selectPoolKeys(
		candidates,
		ctx,
		ctx.forYou && taste.signal === "some" ? (key) => rankOf(taste, key) : null,
	)

	const [suggestions, saved, choiceArt] = await Promise.all([
		getTitleCards(keys.slice(0, MAX_KEYS), ctx, taste),
		member ? getServiceCards(ctx.services) : [],
		// Mini Discover: a picture per option of its tabs, the same for everyone.
		loadChoiceArt(snapshot, candidates, getDisplayFields),
	])

	return {
		member,
		suggestions,
		savedServices: saved.map((s) => s.name),
		choiceArt,
	}
}
