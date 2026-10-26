// The person page's filmography posters and header portrait on phones (owner Q40b, #753): under 768 px wide they come as
// TMDB's 185 px files, as the title page's cast photos do (details/cast-photo.ts). On a 2.625x phone the grid's posters
// (115 CSS px) took the 342 px file (69 posters, 1.9 MB on Diane Keaton's page) and the portrait (96 CSS px) the 421 px
// one; the 185 px files are 1.1 MB and a quarter of that. The images are drawn at the same size; from 768 px every
// window takes the file it took before.
import { POSTER_GRID_SIZES } from "~/ui/Poster"
import { PHONE_185_SLOT, type SizeRule } from "~/utils/tmdb-image"

/** The grid's own rules from 768 px, then the phone rule. */
const GRID_SIZES: SizeRule[] = [
	...POSTER_GRID_SIZES.filter(([condition]) => {
		const min = /min-width: (\d+)px/.exec(condition ?? "")
		return min !== null && Number(min[1]) >= 768
	}),
	PHONE_185_SLOT,
]

/** MovieTvCard's poster props for the filmography grid. */
export const PERSON_GRID_POSTER = { sizes: GRID_SIZES, minWidth: 185 } as const

/** The header portrait's props: 96 px wide on a phone, 120 px from 640 px. */
export const PERSON_PORTRAIT = {
	sizes: [["(min-width: 768px)", "120px"], PHONE_185_SLOT] as SizeRule[],
	width: 120,
	minWidth: 120,
	maxWidth: 120,
} as const
