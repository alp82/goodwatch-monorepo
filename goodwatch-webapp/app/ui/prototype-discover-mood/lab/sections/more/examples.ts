// PROTOTYPE (Discover lab, round 17): well-known examples per preset for More f's poster tiles, hand-picked by TMDB id.
// Checked 2026-10-29 through the proxy: rating counts are GoodWatch's overall voting count (/api/similar-media),
// popularity ranks are Discover's default order (/api/discover/results, 40 per page; it stops at #10,000, so Deep cuts
// are titles whose TMDB popularity is well under the #10,000 title's 7.9). Budgets, box office and seasons are the
// public figures.
import { useMemo } from "react"
import { useTitleNames } from "~/ui/filter-bar/useFilterData"
import { type TitleKey, titleKey } from "~/utils/title-key"
import { type MoreKey, type Roi } from "./store"

const m = (id: number) => titleKey("movie", id)
const s = (id: number) => titleKey("show", id)

/** Per key, one list per preset (PRESETS order). */
export const EXAMPLES: Partial<Record<MoreKey, TitleKey[][]>> = {
	votes: [
		[m(362178), m(576005), m(376534)], // Hidden gems: Kaili Blues 5.6K, Saint Frances 6.4K, Cameraperson 4.1K
		[m(414453), m(749004), m(664300)], // Known to fans: Columbus 27K, Petite Maman 22K, Shiva Baby 45K
		[m(666277), m(965150), m(346648)], // Well known: Past Lives 187K, Aftersun 138K, Paddington 2 126K
		[m(155), m(13), s(1396)], // Everyone's seen it: The Dark Knight 3.8M, Forrest Gump 2.7M, Breaking Bad 2.7M
	],
	rank: [
		[m(1368337), m(969681), s(95480)], // Popular now: The Odyssey #50, Spider-Man: Brand New Day #29, Slow Horses #49
		[m(194), m(747), m(76203)], // Under the radar: Amélie #3,185, Shaun of the Dead #4,773, 12 Years a Slave #6,399
		[m(8942), m(238628), m(443463)], // Deep cuts: Wendy and Lucy, Tangerines, Leave No Trace (popularity 2.3 to 4.3)
	],
	budget: [
		[m(376867), m(244786), m(23827)], // Indie: Moonlight ~$4M, Whiplash $3.3M, Paranormal Activity $15K
		[m(496243), m(313369), m(546554)], // Mid budget: Parasite $11M, La La Land $30M, Knives Out $40M
		[m(603), m(16869), m(210577)], // Big: The Matrix $63M, Inglourious Basterds $70M, Gone Girl $61M
		[m(19995), m(299534), m(597)], // Blockbuster: Avatar $237M, Avengers: Endgame $356M, Titanic $200M
	],
	revenue: [
		[m(419430), m(329865), m(120467)], // $100M+: Get Out $255M, Arrival $203M, The Grand Budapest Hotel $174M
		[m(27205), m(157336), m(293660)], // $500M+: Inception $837M, Interstellar $730M, Deadpool $782M
		[m(346698), m(109445), m(135397)], // $1B+: Barbie $1.44B, Frozen $1.28B, Jurassic World $1.67B
	],
	seasons: [
		[s(1437), s(87108), s(87739)], // One season: Firefly, Chernobyl, The Queen's Gambit
		[s(67070), s(94605), s(67744)], // 2 to 3: Fleabag, Arcane, Mindhunter (2 each)
		[s(1438), s(1398), s(1104)], // 4 to 7: The Wire 5, The Sopranos 6, Mad Men 7
		[s(456), s(1416), s(1668)], // 8+: The Simpsons, Grey's Anatomy, Friends
	],
}

export const ROI_EXAMPLES: Record<Roi, TitleKey[]> = {
	hit: [m(475557), m(2667)], // Joker ~$60M to $1.08B, The Blair Witch Project $60K to $248M
	flop: [m(615777), m(428078)], // Babylon ~$80M to $63M, Mortal Engines ~$100M+ to $84M
}

const ALL: TitleKey[] = [...Object.values(EXAMPLES).flat(2), ...Object.values(ROI_EXAMPLES).flat()]

/** Poster paths by title key, as they resolve (one read for every example). */
export function useExamplePosters(): Map<TitleKey, string | null> {
	const names = useTitleNames(ALL, "")
	return useMemo(() => new Map([...names.byKey].map(([k, t]) => [k, t.poster])), [names.byKey])
}
