// What the card of the Hot on socials page (/hot, and /hot-on-socials, which moves there) shows: the top five of the
// page's list with their ranks (HotCard.tsx): like the page (HotPage.tsx), only titles with posts, with or without a poster. The ranking is made
// once a day, so the card store redraws this card when it is an hour old and never serves one older than a day
// (og-image.server.tsx).
import type { TalkedRow } from "~/domain/talked-about-now"
import type { OgHotContent } from "~/ui/og-image/HotCard"

export interface HotCardDeps {
	/** Whether a guest sees the page; when not, it answers 404 and has no card. */
	enabled: () => boolean
	/** The page's ranking. Throws when it can't be read, so no card is stored in its place. */
	ranking: () => Promise<TalkedRow | null>
}

// The card's list (HotCard.tsx).
export const HOT_CARD_TITLES = 5

/** The card of /hot, or null when the page is off or has no ranking. */
export async function hotCardContent(
	deps: HotCardDeps,
): Promise<OgHotContent | null> {
	if (!deps.enabled()) return null
	const row = await deps.ranking()
	const titles = (row?.titles ?? [])
		.filter((title) => title.items.length > 0)
		.sort((a, b) => a.rank - b.rank)
		.slice(0, HOT_CARD_TITLES)
	if (!titles.length) return null
	return {
		kind: "hot",
		titles: titles.map(({ rank, title, curve }) => ({ rank, title, curve })),
	}
}
