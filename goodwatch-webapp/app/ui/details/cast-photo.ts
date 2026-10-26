// The title page's cast photos (Actors.tsx): a 144 px circle cut from TMDB's 2:3 profile picture.
// On a phone (under 768 px wide) they come as TMDB's 185 px file (owner, Q38, #753): the 421 px one (22 to 67 KB each,
// twelve at a time) filled a phone's connection when the reader reached the cast, and a tap on a person waited behind
// them (production: about 1 s; with the 185 px files 351 instead of 697 ms in a local test). TMDB has no size in
// between. `sizes` is how a browser picks the file: a phone's slot is given as 52 px, so that even at a pixel ratio of
// 3.5 the 185 px file covers it. The circle is drawn 144 px wide as before; wider screens take the file for 144 px at
// their own pixel ratio, as before.
import { PHONE_185_SLOT, type SizeRule } from "~/utils/tmdb-image"

const CAST_PHOTO_SIZES: SizeRule[] = [
	["(min-width: 768px)", "144px"],
	PHONE_185_SLOT,
]

/** The props of a cast photo's TmdbImage (kind "profile"). */
export const CAST_PHOTO = {
	sizes: CAST_PHOTO_SIZES,
	width: 144,
	maxWidth: 144,
	minWidth: 144,
} as const
