// Sides of you on the TV's home (#673), shaped for home's guide from the Taste page's sides view: which picks each
// side shows and in which order the sides are listed. Pure, so the order rules have tests (home-sides.server.test.ts);
// tv-sides.server.ts reads the view.
//
// - Order: sides group, personal order ranks. Inside a side the picks keep the engine's order, which is the
//   member's personal order when it is on for them. The sides are listed by where each side's best pick stands in
//   personal order, so the first is tonight's side; without personal order, by that pick's match.
// - Picks: a side's More of this, the ones on the member's services when enough stream there, one per franchise,
//   and a title on several sides only on the side where it stands first.
// - Words: a side is shown by its loved posters. Its name and its moods' names are descriptive words and wait for
//   the words gate (#656): `HOME_SIDE_WORDS` stays off until it passes.
import { MOOD_BY_KEY } from "~/domain/moods"
import {
	type OrderTitles,
	franchiseOf,
} from "~/server/taste-portrait/sides.server"
import type { SidesView } from "~/server/taste-portrait/view"
import type { TvHomeSide } from "~/ui/living-room/tv/tv-home"
import { HOME_SIDE_PICKS } from "~/ui/living-room/tv/tv-machine"
import { portraitListTitle } from "~/ui/living-room/tv/tv-taste"
import type { TitleKey } from "~/utils/title-key"

/** Side names and mood names on home: off until the words gate (#656) passes. */
export const HOME_SIDE_WORDS = false
/** A side's picks are the ones on the member's services when at least this many stream there. */
const MIN_ON_SERVICES = 4
/** The loved posters a side is shown by. */
const LOVED = 4

type View = Pick<
	SidesView,
	"status" | "subject" | "sides" | "titles" | "hasServices"
>

/**
 * The member's sides as home's guide lists them. `order` is the member's personal order, when it is on for them.
 * Empty when the portrait has no sides of theirs.
 */
export function homeSides(
	view: View,
	order?: OrderTitles,
	words = HOME_SIDE_WORDS,
): TvHomeSide[] {
	if (
		view.status !== "ready" ||
		view.subject.kind !== "member" ||
		!view.sides.length
	)
		return []
	const known = (key: TitleKey) => view.titles[key] != null
	const lists = view.sides.map((side) => {
		const all = side.moreOfThis.filter(known)
		const there = all.filter((key) => view.titles[key].onMyServices === true)
		const onServices = view.hasServices && there.length >= MIN_ON_SERVICES
		return {
			keys: onServices ? there : all,
			fewOnServices: view.hasServices && !onServices,
		}
	})
	// A title on several sides stays where it stands first; on a tie, on the engine's earlier side.
	const home = new Map<TitleKey, { side: number; at: number }>()
	lists.forEach(({ keys }, side) => {
		keys.forEach((key, at) => {
			const best = home.get(key)
			if (!best || at < best.at) home.set(key, { side, at })
		})
	})
	const sides = view.sides.map((side, index) => {
		const franchises = new Set<string>()
		const picks = lists[index].keys
			.filter((key) => home.get(key)?.side === index)
			.filter((key) => {
				const franchise = franchiseOf(view.titles[key].title)
				if (franchises.has(franchise)) return false
				franchises.add(franchise)
				return true
			})
			.slice(0, HOME_SIDE_PICKS)
		const shaped: TvHomeSide = {
			id: side.id,
			loved: side.here
				.flatMap((key) => view.titles[key] ?? [])
				.slice(0, LOVED)
				.map((title) => ({
					key: portraitListTitle(title).key,
					title: title.title,
					poster: title.poster,
				})),
			picks: picks.map((key) => portraitListTitle(view.titles[key])),
			fewOnServices: lists[index].fewOnServices,
			watchNext: side.moods.length
				? `/watch-next?moods=${side.moods.join(",")}`
				: "/watch-next",
			words: words
				? {
						name: side.name,
						moods: side.moods.map((mood) => MOOD_BY_KEY[mood].name),
					}
				: null,
		}
		return { shaped, first: picks[0] ?? null, index }
	})
	return listOrder(sides, view, order).map(({ shaped }) => shaped)
}

/**
 * The sides by where each one's best pick stands in personal order (without it, by that pick's match, then the
 * engine's order). Sides without picks come last.
 */
function listOrder<T extends { first: TitleKey | null; index: number }>(
	sides: T[],
	view: View,
	order?: OrderTitles,
): T[] {
	const firsts = sides.flatMap((side) =>
		side.first == null ? [] : [side.first],
	)
	const ranked = order
		? order(firsts)
		: [...firsts].sort(
				(a, b) => (view.titles[b].match ?? 0) - (view.titles[a].match ?? 0),
			)
	const rank = new Map(ranked.map((key, at) => [key, at]))
	const at = (side: T) =>
		side.first == null
			? Number.POSITIVE_INFINITY
			: (rank.get(side.first) ?? firsts.length)
	return [...sides].sort((a, b) => at(a) - at(b) || a.index - b.index)
}
