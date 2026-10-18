// PROTOTYPE - throwaway. What the My library hub prototype shows on each subpage's entry: a few posters of the
// statuses' lists, in their default order, and the hidden titles' count. Reads PROTOTYPE_MEMBER_ID like
// prototype-my-library-rescore.server.ts. Nothing is written.
import { type LibraryStatus, libraryOrder } from "~/domain/my-library"
import { getUserData } from "~/server/userData.server"
import { type MediaKey, parseMediaKey } from "~/types/user-data"
import { query } from "~/utils/crate"

export interface HubPoster {
	key: MediaKey
	title: string
	poster_path: string | null
}

export interface HubPreviews {
	posters: Record<LibraryStatus, HubPoster[]>
	hidden: number
}

const STATUSES: LibraryStatus[] = [
	"want",
	"seen",
	"watching",
	"on_hold",
	"dropped",
	"unrated",
]
const PER_STATUS = 12

export async function getHubPreviews(): Promise<HubPreviews | null> {
	const member = process.env.PROTOTYPE_MEMBER_ID
	if (!member) return null
	const data = await getUserData({ user_id: member })
	const keysBy = Object.fromEntries(
		STATUSES.map((status) => [
			status,
			libraryOrder(data, { status, sort: null, kind: "all", q: "" }).keys.slice(
				0,
				PER_STATUS,
			),
		]),
	) as Record<LibraryStatus, MediaKey[]>
	const all = [...new Set(Object.values(keysBy).flat())]
	const ids = { movie: [] as number[], show: [] as number[] }
	for (const key of all) {
		const { mediaType, tmdbId } = parseMediaKey(key)
		ids[mediaType].push(tmdbId)
	}
	const cards = new Map<MediaKey, HubPoster>()
	await Promise.all(
		(["movie", "show"] as const).map(async (type) => {
			if (!ids[type].length) return
			const rows = await query<{
				tmdb_id: number
				title: string | null
				poster_path: string | null
			}>(
				`SELECT tmdb_id, title, poster_path FROM ${type} WHERE tmdb_id IN (${ids[type].map(() => "?").join(", ")})`,
				ids[type],
			)
			for (const row of rows) {
				const key: MediaKey = `${type}-${Number(row.tmdb_id)}`
				cards.set(key, {
					key,
					title: row.title ?? "",
					poster_path: row.poster_path,
				})
			}
		}),
	)
	const posters = Object.fromEntries(
		STATUSES.map((status) => [
			status,
			keysBy[status].flatMap((key) => cards.get(key) ?? []),
		]),
	) as Record<LibraryStatus, HubPoster[]>
	return { posters, hidden: Object.keys(data.notInterested ?? {}).length }
}
