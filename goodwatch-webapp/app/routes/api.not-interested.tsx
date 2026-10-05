import { titleToDashed } from "~/utils/helpers"
import { json, type LoaderFunctionArgs } from "@remix-run/node"
import { readNotInterested } from "~/server/not-interested-store.server"
import { getTitleCards, MAX_KEYS, type TitleCard } from "~/server/title-cards.server"
import { getMemberViewerContext } from "~/server/viewer.server"
import { loadTaste } from "~/server/taste/index.server"
import { getAuthFromRequest } from "~/utils/auth"
import { titleKey } from "~/utils/title-key"

export async function loader({ request }: LoaderFunctionArgs) {
	const { user, headers } = await getAuthFromRequest({ request })
	headers.set("Cache-Control", "private, no-store")
	if (!user) return json({ titles: [] }, { headers })
	const rows = await readNotInterested(user.id)
	if (!rows.length) return json({ titles: [] }, { headers })
	const viewer = await getMemberViewerContext(user.id, "US")
	const taste = await loadTaste(viewer.viewer)
	const hiddenAt = new Map(rows.map((row) => [titleKey(row.media_type, row.tmdb_id), new Date(row.updated_at).toISOString()]))
	const keys = [...hiddenAt.keys()]
	const titles: (TitleCard & { hiddenAt: string; href: string })[] = []
	for (let i = 0; i < keys.length; i += MAX_KEYS) {
		const cards = await getTitleCards(keys.slice(i, i + MAX_KEYS), viewer, taste)
		titles.push(...cards.map((card) => ({ ...card, notInterested: true, href: `/${card.media_type}/${card.tmdb_id}-${titleToDashed(card.title)}`, hiddenAt: hiddenAt.get(card.key)! })))
	}
	return json({ titles }, { headers })
}
