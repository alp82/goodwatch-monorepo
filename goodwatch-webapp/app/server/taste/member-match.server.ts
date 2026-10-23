// The match between a signed-in visitor and a profile's owner, 1 to 99 (formula: member-match-formula.ts).
//
// - Both tastes come from the taste store (member.server.ts); either below MIN_LIKED liked titles has no match.
// - Shared scores come from both members' data (getUserData, cached 5 minutes).
// - The ranking tables come from a sample of member pairs, kept in Redis at `member-match:v1:ranks` and rebuilt when
//   older than a day. One instance rebuilds at a time (`member-match:v1:ranks:lock`, NX). A rebuild reads stored
//   tastes only (never rebuilding one) and the sampled members' scores in one bounded statement; until the first
//   table exists, the blend itself is the share.
// - Without Redis, nothing is sampled and the fallback applies.
import { MIN_LIKED } from "~/server/taste/formula.server"
import { loadMemberTaste, readStoredTaste } from "~/server/taste/member.server"
import { getUserData } from "~/server/userData.server"
import { query } from "~/utils/crate"
import {
	type RankTables,
	blend,
	matchPercent,
	rankTable,
	samplePairs,
} from "./member-match-formula"

const TABLE_KEY = "member-match:v1:ranks"
const LOCK_KEY = "member-match:v1:ranks:lock"
const TABLE_TTL_SECONDS = 3 * 24 * 60 * 60
const LOCK_SECONDS = 10 * 60
const STALE_MS = 24 * 60 * 60_000
const MEMO_MS = 10 * 60_000
/** Members with at least this many scores are sampled. */
const SAMPLE_MIN_SCORES = 10
const SAMPLE_CANDIDATES = 600
const SAMPLE_MEMBERS = 300
const SAMPLE_PAIRS = 5_000
const SAMPLE_MAX_SCORE_ROWS = 400_000

export type MemberMatch = { percent: number; shared: number } | { thin: true; liked: number }

interface StoredTables extends RankTables {
	builtAt: number
	members: number
	pairs: number
}

interface MatchRedis {
	get(key: string): Promise<string | null>
	set(...args: (string | number)[]): Promise<unknown>
}

async function redis(): Promise<MatchRedis | null> {
	const { getRedisCluster } = await import("~/utils/cache")
	return getRedisCluster() as unknown as MatchRedis | null
}

/** Score keys "movie-550" → score, for one member. */
async function scoresOf(userId: string): Promise<Map<string, number>> {
	const data = await getUserData({ user_id: userId })
	const out = new Map<string, number>()
	for (const [key, entry] of Object.entries(data.scores)) if (entry.score) out.set(key, Number(entry.score))
	return out
}

export function sharedScores(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): [number, number][] {
	const pairs: [number, number][] = []
	const [small, large] = a.size <= b.size ? [a, b] : [b, a]
	for (const [key, score] of small) {
		const other = large.get(key)
		if (other !== undefined) pairs.push(small === a ? [score, other] : [other, score])
	}
	return pairs
}

/**
 * The match between two members, or `thin` with the smaller of the two liked counts when either has fewer than
 * MIN_LIKED liked titles. `shared` is how many titles both scored.
 */
export async function getMemberMatch(viewerId: string, ownerId: string): Promise<MemberMatch> {
	const [viewer, owner, viewerScores, ownerScores, tables] = await Promise.all([
		loadMemberTaste(viewerId),
		loadMemberTaste(ownerId),
		scoresOf(viewerId),
		scoresOf(ownerId),
		rankTables(),
	])
	if (!viewer.vector || !owner.vector || viewer.liked < MIN_LIKED || owner.liked < MIN_LIKED)
		return { thin: true, liked: Math.min(viewer.liked, owner.liked) }
	const shared = sharedScores(viewerScores, ownerScores)
	return { percent: matchPercent(blend(viewer.vector, owner.vector, shared), tables), shared: shared.length }
}

// ---------- the sample of member pairs ----------

let memo: { at: number; tables: StoredTables | null } | null = null
let building: Promise<void> | null = null

/** The ranking tables, rebuilt in the background when missing or older than a day. Never throws. */
export async function rankTables(): Promise<RankTables | null> {
	const now = Date.now()
	if (memo && now - memo.at < MEMO_MS) return memo.tables
	let tables: StoredTables | null = null
	try {
		const raw = await (await redis())?.get(TABLE_KEY)
		tables = raw ? (JSON.parse(raw) as StoredTables) : null
	} catch (error) {
		console.error("Member match: reading the ranking tables failed:", error)
	}
	memo = { at: now, tables }
	if (!tables || now - tables.builtAt > STALE_MS) {
		building ??= rebuildTables()
			.catch((error) => console.error("Member match: building the ranking tables failed:", error))
			.finally(() => {
				building = null
			})
	}
	return tables
}

async function rebuildTables(): Promise<void> {
	const store = await redis()
	if (!store) return
	const locked = await store.set(LOCK_KEY, String(Date.now()), "EX", LOCK_SECONDS, "NX")
	if (locked !== "OK") return
	const startedAt = Date.now()
	const candidates = await query<{ user_id: string }>(
		`SELECT user_id FROM user_score GROUP BY user_id HAVING count(*) >= ? LIMIT 20000`,
		[SAMPLE_MIN_SCORES],
	)
	const ids = shuffle(candidates.map((row) => row.user_id)).slice(0, SAMPLE_CANDIDATES)
	const tastes: { id: string; vector: Float32Array }[] = []
	for (let i = 0; i < ids.length && tastes.length < SAMPLE_MEMBERS; i += 50) {
		const batch = await Promise.all(ids.slice(i, i + 50).map(async (id) => ({ id, taste: await readStoredTaste(id) })))
		for (const { id, taste } of batch)
			if (taste && taste.liked >= MIN_LIKED && tastes.length < SAMPLE_MEMBERS) tastes.push({ id, vector: taste.vector })
	}
	if (tastes.length < 10) return
	const rows = await query<{ user_id: string; media_type: string; tmdb_id: number; score: number }>(
		`SELECT user_id, media_type, tmdb_id, score FROM user_score WHERE user_id = ANY(?) AND score > 0 LIMIT ${SAMPLE_MAX_SCORE_ROWS}`,
		[tastes.map((t) => t.id) as never],
	)
	const scores = new Map<string, Map<string, number>>()
	for (const row of rows) {
		let own = scores.get(row.user_id)
		if (!own) scores.set(row.user_id, (own = new Map()))
		own.set(`${row.media_type}-${row.tmdb_id}`, Number(row.score))
	}
	const vector: number[] = []
	const blended: number[] = []
	const pairs = samplePairs(tastes.length, SAMPLE_PAIRS)
	for (const [i, j] of pairs) {
		const a = tastes[i]
		const b = tastes[j]
		const shared = sharedScores(scores.get(a.id) ?? new Map(), scores.get(b.id) ?? new Map())
		const value = blend(a.vector, b.vector, shared)
		;(value.kind === "blended" ? blended : vector).push(value.value)
		// Every blended pair also has a vector likeness: rank vector-only pairs against all pairs' likeness.
		if (value.kind === "blended") vector.push(blend(a.vector, b.vector, []).value)
	}
	const stored: StoredTables = {
		builtAt: Date.now(),
		members: tastes.length,
		pairs: pairs.length,
		vector: rankTable(vector),
		blended: rankTable(blended),
	}
	await store.set(TABLE_KEY, JSON.stringify(stored), "EX", TABLE_TTL_SECONDS)
	memo = { at: Date.now(), tables: stored }
	console.info(
		`Member match: ranking tables from ${tastes.length} members, ${pairs.length} pairs (${blended.length} blended), in ${Date.now() - startedAt} ms`,
	)
}

function shuffle<T>(list: T[]): T[] {
	for (let i = list.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[list[i], list[j]] = [list[j], list[i]]
	}
	return list
}
