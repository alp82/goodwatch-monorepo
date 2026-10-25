// The For you chapter's pick: the show the chapter recommends, the titles it says the viewer loved, the match, and the
// other titles around it on the wall. From /api/intro: `extra.forYou`, `extra.shows` (modern shows) and `pool`.
import type { IntroCard } from "~/ui/living-room/intro/data"
import type { IntroData } from "~/ui/living-room/intro/scene"

type ForYou = { pick: number; loved: number[]; match: number }

export function pickOf(data: IntroData) {
	const shows = (data.extra.shows ?? []) as IntroCard[]
	const forYou = data.extra.forYou as ForYou | undefined
	const all = [...shows, ...data.pool]
	const find = (k: number) => all.find((c) => c.key === k) ?? null
	const hero = (forYou && find(forYou.pick)) || shows[0] || data.pool[1]
	const loved = (forYou?.loved ?? [])
		.map(find)
		.filter((c): c is IntroCard => Boolean(c))
	/** The wall around the pick: the other modern shows first, then the pool. */
	const others = [
		...shows.filter((c) => c.key !== hero.key),
		...data.pool.filter(
			(c) => c.key !== hero.key && !loved.some((l) => l.key === c.key),
		),
	]
	return { hero, loved, match: forYou?.match ?? 90, others }
}
