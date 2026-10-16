// Sides of you on the TV's home (#673), shaped for home's guide from the Taste page's sides view: which picks each
// side shows and in which order the sides are listed. Pure, so the order rules have tests (home-sides.server.test.ts);
// tv-sides.server.ts reads the view.
//
// - Order: sides group, personal order ranks. Inside a side the picks keep the engine's order, which is the
//   member's personal order when it is on for them. The sides are listed by where each side's best pick stands in
//   personal order, so the first is tonight's side; without personal order, by its pick of the highest match.
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
	// A title on several sides stays where it stands first; on a tie, on the engine's earlier side.
	const home = new Map<TitleKey, { side: number; at: number }>()
	view.sides.forEach((side, index) => {
		side.moreOfThis.filter(known).forEach((key, at) => {
			const best = home.get(key)
			if (!best || at < best.at) home.set(key, { side: index, at })
		})
	})
	const sides = view.sides.map((side, index) => {
		const kept = side.moreOfThis.filter((key) => home.get(key)?.side === index)
		// Decided on what is left of the side, so a title another side keeps never empties this one, and before one
		// title per franchise, so a sequel that streams is not lost to a first film that doesn't.
		const there = onePerFranchise(
			kept.filter((key) => view.titles[key].onMyServices === true),
			view,
		)
		const onServices = view.hasServices && there.length >= MIN_ON_SERVICES
		const picks = (onServices ? there : onePerFranchise(kept, view)).slice(
			0,
			HOME_SIDE_PICKS,
		)
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
			fewOnServices: view.hasServices && !onServices,
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
		return { shaped, picks, index }
	})
	return listOrder(sides, view, order).map(({ shaped }) => shaped)
}

/** The first title of each franchise, in the list's order. */
function onePerFranchise(keys: TitleKey[], view: View): TitleKey[] {
	const seen = new Set<string>()
	return keys.filter((key) => {
		const franchise = franchiseOf(view.titles[key].title)
		if (seen.has(franchise)) return false
		seen.add(franchise)
		return true
	})
}

/**
 * The sides by where each one's best pick stands in personal order: the earliest of its picks when all the sides'
 * picks are ordered together. Without personal order, by its pick of the highest match, then the engine's order.
 * Sides without picks come last.
 */
function listOrder<T extends { picks: TitleKey[]; index: number }>(
	sides: T[],
	view: View,
	order?: OrderTitles,
): T[] {
	const all = sides.flatMap((side) => side.picks)
	const ranked = order
		? order(all)
		: [...all].sort(
				(a, b) => (view.titles[b].match ?? 0) - (view.titles[a].match ?? 0),
			)
	const rank = new Map(ranked.map((key, at) => [key, at]))
	const best = (side: T) =>
		Math.min(
			Number.POSITIVE_INFINITY,
			...side.picks.map((key) => rank.get(key) ?? all.length),
		)
	return [...sides].sort((a, b) => best(a) - best(b) || a.index - b.index)
}
