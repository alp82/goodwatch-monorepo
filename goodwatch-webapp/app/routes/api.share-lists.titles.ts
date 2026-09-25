// Titles for the share list editor. ?q= searches movies and shows; ?keys=movie:603,show:1399 returns card data
// for those titles, so a title picked from search gets its score and genre.
import { json, type LoaderFunctionArgs } from "@remix-run/node"
import { type ListEntry, parseTitleKey, resolveCardTitles, searchTitles } from "~/server/share-lists/titles.server"
import type { CardTitle } from "~/ui/share-card/model"

const MAX_KEYS = 10

export async function loader({ request }: LoaderFunctionArgs) {
	const params = new URL(request.url).searchParams
	const keys = params.get("keys")
	if (keys !== null) {
		const entries = keys
			.split(",")
			.slice(0, MAX_KEYS)
			.map(parseTitleKey)
			.filter((e): e is ListEntry => !!e)
		return json<{ titles: CardTitle[] }>({ titles: await resolveCardTitles(entries) }, { headers: { "Cache-Control": "public, max-age=3600" } })
	}
	const titles = await searchTitles(params.get("q") ?? "", request.signal)
	return json<{ titles: CardTitle[] }>({ titles }, { headers: { "Cache-Control": "public, max-age=3600" } })
}
