// Only Redis retains member summaries. Snapshot version and taste write time invalidate mood counts.
import Redis from "ioredis"
import { MOOD_KEYS, type MoodKey } from "~/domain/moods"
import type { TitleSnapshot } from "~/server/title-snapshot/index.server"
import { getRedisCluster } from "~/utils/cache"
import { query } from "~/utils/crate"
import { titleKey } from "~/utils/title-key"

interface WishlistSummary {
	keys: number[]
	moodCounts: Record<MoodKey, number> | null
}

interface StoredSummary {
	readFrom: number
	version: string | null
	wishlist: WishlistSummary
}

let connection: Redis | undefined
function redis() {
	if (process.env.TASTE_REDIS_URL) {
		connection ??= new Redis(process.env.TASTE_REDIS_URL, {
			maxRetriesPerRequest: 1,
		})
		return connection
	}
	return getRedisCluster()
}

export async function loadLivingRoomWishlist(
	userId: string,
	snapshot: TitleSnapshot | null,
): Promise<WishlistSummary> {
	const store = redis()
	const key = `living-room:wishlist:v1:${userId}`
	const version = snapshot?.version ?? null
	try {
		if (store) {
			const [raw, touched] = await Promise.all([
				store.get(key),
				store.get(`taste:touched:${userId}`),
			])
			if (raw) {
				const entry: StoredSummary = JSON.parse(raw)
				// Crate's non-key reads may lag a committed write by one refresh interval.
				if (
					entry.version === version &&
					entry.readFrom >= (Number(touched) || 0) + 1500
				)
					return entry.wishlist
			}
		}
	} catch (error) {
		console.error("Living room: reading Wishlist summary failed", error)
	}
	const readFrom = Date.now()
	const rows = await query<{ tmdb_id: number; media_type: "movie" | "show" }>(
		`SELECT tmdb_id, media_type FROM user_wishlist WHERE user_id = ?
		 ORDER BY created_at DESC, media_type ASC, tmdb_id ASC LIMIT 20000`,
		[userId],
	)
	const keys = rows.map((row) => titleKey(row.media_type, Number(row.tmdb_id)))
	const moodCounts = Object.fromEntries(
		MOOD_KEYS.map((mood) => [mood, 0]),
	) as Record<MoodKey, number>
	if (snapshot) {
		for (const key of keys) {
			for (const mood of snapshot.facts(key)?.moods ?? []) moodCounts[mood]++
		}
	}
	const wishlist = { keys, moodCounts: snapshot ? moodCounts : null }
	try {
		await store?.set(
			key,
			JSON.stringify({ readFrom, version, wishlist } satisfies StoredSummary),
			"EX",
			60,
		)
	} catch (error) {
		console.error("Living room: storing Wishlist summary failed", error)
	}
	return wishlist
}
