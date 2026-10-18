import { type ActionFunctionArgs, json } from "@remix-run/node"
import { SCORE_BATCH_MAX } from "~/domain/my-scores"
import { type Score, updateScores } from "~/server/scores.server"
import { getUserIdFromRequest } from "~/utils/auth"

// Several scores in one request, from Your scores (My library) when a member changes many titles at once.
//   POST /api/update-scores-batch  { "items": [{ "tmdb_id": 603, "media_type": "movie", "score": 8 }, …] }
// At most MAX_ITEMS items; the page sends a larger selection in several requests. Each item goes through the
// site's own score writer, as a single score does, five at a time. Changing a score only: clearing one asks
// first on the title page. For members: 401 for a guest.

const MAX_ITEMS = SCORE_BATCH_MAX
const AT_ONCE = 5

const headers = { "Cache-Control": "private, no-store" }

interface Item {
	tmdb_id: number
	media_type: "movie" | "show"
	score: Score
}
const isItem = (value: unknown): value is Item => {
	const item = value as Item
	return (
		Boolean(item) &&
		Number.isSafeInteger(item.tmdb_id) &&
		item.tmdb_id > 0 &&
		(item.media_type === "movie" || item.media_type === "show") &&
		Number.isInteger(item.score) &&
		item.score >= 1 &&
		item.score <= 10
	)
}

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST")
		return json({ error: "Send a POST" }, { status: 405, headers })
	const userId = await getUserIdFromRequest({ request })
	if (!userId) return json({ error: "Sign in" }, { status: 401, headers })
	const body = (await request.json().catch(() => null)) as { items?: unknown } | null
	const items = body?.items
	if (!Array.isArray(items) || !items.length || items.length > MAX_ITEMS || !items.every(isItem))
		return json(
			{ error: `Send items: 1 to ${MAX_ITEMS} of { tmdb_id, media_type, score 1-10 }` },
			{ status: 400, headers },
		)
	// A few titles at a time: each write settles its own title's tracking rows, so titles don't wait on each other.
	const results: { tmdb_id: number; media_type: string; status: "success" | "failed" }[] = new Array(items.length)
	let next = 0
	const worker = async () => {
		while (next < items.length) {
			const at = next++
			const item = items[at]
			const { status } = await updateScores({ ...item, user_id: userId }).catch(() => ({
				status: "failed" as const,
			}))
			results[at] = { tmdb_id: item.tmdb_id, media_type: item.media_type, status }
		}
	}
	await Promise.all(Array.from({ length: Math.min(AT_ONCE, items.length) }, worker))
	return json({ results }, { headers })
}
