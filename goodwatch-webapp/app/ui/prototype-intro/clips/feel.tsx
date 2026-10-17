// PROTOTYPE - throwaway. Intro clips of group "feel": fingerprint (title analysis) and recommendations.
import type { Clip } from "../clip"
import "./feel.css"
import { FingerprintAttributes, FingerprintDials, FingerprintMatch, FingerprintPair } from "./feel/fingerprint"
import { RecsBecause, RecsResort, RecsSides, RecsTonight } from "./feel/recommendations"

export const CLIPS: Clip[] = [
	{
		id: "fingerprint-dials",
		section: "fingerprint",
		name: "Six dials fill in",
		ms: 6500,
		note: "A poster deals in; its six dials (Energy, Heart, Humor, World, Craft, Style) fill one by one; a one-line verdict.",
		C: FingerprintDials,
	},
	{
		id: "fingerprint-pair",
		section: "fingerprint",
		name: "Same genre, different evening",
		ms: 6500,
		note: "Two titles that share a genre and feel the most different, side by side, with their top feel words.",
		C: FingerprintPair,
	},
	{
		id: "fingerprint-attributes",
		section: "fingerprint",
		name: "Attributes with their strength",
		ms: 6000,
		note: "Over a slow-drifting backdrop, the four strongest attributes deal in, each with a bar for how strong it is.",
		C: FingerprintAttributes,
	},
	{
		id: "fingerprint-match",
		section: "fingerprint",
		name: "Its feel finds its matches",
		ms: 7500,
		note: "A loved title's attributes pop out, fly across, and land on three titles that share them, with match %.",
		C: FingerprintMatch,
	},
	{
		id: "recommendations-because",
		section: "recommendations",
		name: "Because you loved these",
		ms: 6500,
		note: "Three loved posters fan in, a line draws, the pick deals in with its match and what it shares.",
		C: RecsBecause,
	},
	{
		id: "recommendations-resort",
		section: "recommendations",
		name: "Rate three, the list sorts itself",
		ms: 6500,
		note: "Ratings land on three posters; six picks reorder from score order into match order, then show their match.",
		C: RecsResort,
	},
	{
		id: "recommendations-sides",
		section: "recommendations",
		name: "Sides of you",
		ms: 7000,
		note: "Liked titles fall into groups by how they feel; each group gets its own pick.",
		C: RecsSides,
	},
	{
		id: "recommendations-tonight",
		section: "recommendations",
		name: "One pick for tonight",
		ms: 6000,
		note: "The top pick full-bleed: title, score ring, match, the feel it shares, because you loved…",
		C: RecsTonight,
	},
]
