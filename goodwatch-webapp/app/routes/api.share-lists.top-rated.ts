// The signed-in person's five highest-rated titles as card data, for the "Share your top 5" card on Taste.
// Guests rank their ratings in the browser and look the titles up through /api/share-lists/titles?keys=.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import {
	prefillTitles,
	topRatedEntries,
} from "~/server/share-lists/prefill.server"
import type { CardTitle } from "~/ui/share-card/model"
import { getUserIdFromRequest } from "~/utils/auth"

export async function loader({ request }: LoaderFunctionArgs) {
	const noStore = { headers: { "Cache-Control": "private, no-store" } }
	const userId = await getUserIdFromRequest({ request })
	if (!userId) return json<{ titles: CardTitle[] }>({ titles: [] }, noStore)
	return json<{ titles: CardTitle[] }>(
		{ titles: await prefillTitles(await topRatedEntries(userId)) },
		noStore,
	)
}
