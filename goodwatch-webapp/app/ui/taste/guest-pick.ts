// A guest's picks from the titles they loved: the TV intro's quiz (living-room/intro/quiz/taste-quiz.tsx) and the
// start page's For you (start/spotlight) both ask this way.
//
// For each kind of title loved (movies, shows), /api/guest-recommendations recommends from the loved titles as scored
// items at 10 (with fewer than five the server answers from Qdrant's recommend-by-example). The lists are merged by
// match, titles the viewer already answered drop out, and the best are read as cards from /api/intro?cards= (score,
// services in the viewer's country). The pick leads with the best card that has a backdrop.
//
// Framework-free, so the tests run it against a mocked `fetch` (guest-pick.test.ts).
import type { TitleCard } from "../../server/title-cards.server.ts"
import { excludeIdsFor } from "./answered.ts"

/** A title as the requests name it. */
export type PickTitle = { tmdb_id: number; media_type: "movie" | "show" }

export type Rec = PickTitle & { match_percentage: number }

/**
 * The pick and the ones after it; `top` null when nothing was left to pick. `cards` keeps every candidate in order, so
 * the pick can be chosen again when the viewer's marks change (a pick saved before has none).
 */
export type GuestPick<C extends TitleCard = TitleCard> = {
	top: C | null
	more: C[]
	fallback: boolean
	cards?: C[]
}

/** At most this many cards per /api/intro request (server/living-room/intro/cards-param.ts MAX_CARDS). */
export const PICK_CARDS = 10

/** How a title is named in the viewer's answered keys (ui/taste/answered.ts). */
export const answerKey = (c: { media_type: string; tmdb_id: number }) =>
	`${c.media_type}-${c.tmdb_id}`

/** The pick to show: candidates the viewer already answered drop out, the best one left with a picture leads. */
export function shownPick<C extends TitleCard>(
	pick: GuestPick<C>,
	answered: ReadonlySet<string>,
	more = 3,
): GuestPick<C> {
	const cards = (
		pick.cards ?? [pick.top, ...pick.more].filter((c): c is C => !!c)
	).filter((c) => !answered.has(answerKey(c)))
	const top =
		cards.find((c) => c.backdrop_path && c.services?.length) ??
		cards.find((c) => c.backdrop_path) ??
		null
	return {
		...pick,
		top,
		more: cards.filter((c) => c !== top && c.poster_path).slice(0, more),
	}
}

/** The recommendations of one kind for the loved titles, leaving out `pool` and the most recent answered titles. */
export async function recsFor(
	type: "movie" | "show",
	picks: readonly PickTitle[],
	pool: readonly PickTitle[],
	answered: ReadonlySet<string>,
	limit = 8,
	signal?: AbortSignal,
): Promise<Rec[]> {
	const params = new URLSearchParams({
		mediaType: type,
		scoredItems: JSON.stringify(
			picks.map((p) => ({
				tmdb_id: p.tmdb_id,
				media_type: p.media_type,
				score: 10,
			})),
		),
		excludeIds: JSON.stringify([
			...pool.map((p) => ({ tmdb_id: p.tmdb_id, media_type: p.media_type })),
			// The most recent of them; the answer is filtered by all of them below.
			...excludeIdsFor([...answered], [], 60),
		]),
		limit: String(limit),
	})
	const res = await fetch(`/api/guest-recommendations?${params}`, { signal })
	if (!res.ok) throw new Error(`guest recommendations ${res.status}`)
	return (await res.json()).recommendations ?? []
}

/**
 * The pick for the loved titles. `pool` are titles shown and passed over (never a pick). `more` is how many follow the
 * pick, `perType` how many recommendations each kind asks for. Never throws: with nothing to pick, `top` is null and
 * `fallback` true. An aborted request answers the same way; the caller drops it.
 */
export async function findPick<C extends TitleCard = TitleCard>(
	picks: readonly PickTitle[],
	pool: readonly PickTitle[],
	answered: ReadonlySet<string>,
	{
		more = 3,
		perType = 8,
		signal,
	}: { more?: number; perType?: number; signal?: AbortSignal } = {},
): Promise<GuestPick<C>> {
	try {
		const types = [...new Set(picks.map((p) => p.media_type))]
		const lists = await Promise.all(
			types.map((t) =>
				recsFor(t, picks, pool, answered, perType, signal).catch(
					() => [] as Rec[],
				),
			),
		)
		const seen = new Set<string>()
		const recs = lists
			.flat()
			.sort((a, b) => b.match_percentage - a.match_percentage)
			.filter((r) => {
				const k = `${r.media_type}:${r.tmdb_id}`
				if (seen.has(k) || answered.has(answerKey(r))) return false
				seen.add(k)
				return true
			})
			.slice(0, PICK_CARDS)
		if (!recs.length) throw new Error("no recommendations")
		const res = await fetch(
			`/api/intro?cards=${recs.map((r) => `${r.media_type}:${r.tmdb_id}`).join(",")}`,
			{ signal },
		)
		if (!res.ok) throw new Error(`intro cards ${res.status}`)
		const cards: C[] = ((await res.json()).cards ?? []).filter(
			(c: C) => !answered.has(answerKey(c)),
		)
		const order = (c: C) =>
			recs.findIndex(
				(r) => r.tmdb_id === c.tmdb_id && r.media_type === c.media_type,
			)
		cards.sort((a, b) => order(a) - order(b))
		const found = shownPick(
			{ top: null, more: [], fallback: false, cards },
			answered,
			more,
		)
		if (!found.top) throw new Error("no card with a picture")
		return found
	} catch (error) {
		if (!signal?.aborted) console.error("Guest pick: none found", error)
		return { top: null, more: [], fallback: true }
	}
}
