// PROTOTYPE - throwaway. Round 6 intro clips, group "r6score": chapter 2 (One score) and chapter 3 (Picked for you).
// Chapter 2 refines round 5's score-orbit (brand-colored cards with big logos, beside or into the ring); chapter 3
// refines recommendations-wall (a faster light, a punchier click). Hand-overs as round 5: chapter 2 ends on RingEnd,
// chapter 3 starts on it and ends on the hero alone.
import type { Clip } from "../clip"
import "./r5score.css"
import { PICK_MS, PickDive, PickFast, PickPointer } from "./r6score/pick"
import { SCORE_MS, ScoreAside, ScoreFan, ScoreFeed } from "./r6score/score"
import "./r6score.css"

export const CLIPS: Clip[] = [
	{
		id: "score-cards-aside",
		section: "score",
		name: "Brand cards line up, then step aside the ring",
		ms: SCORE_MS.aside,
		note: "Five big cards in their brands' colors (IMDb yellow, Rotten Tomatoes red and orange, Metacritic green and black) with The Dark Knight's real numbers. They step aside, two left and three right, while the ring fills between them.",
		C: ScoreAside,
	},
	{
		id: "score-cards-feed",
		section: "score",
		name: "Brand cards fly into the ring, one by one",
		ms: SCORE_MS.feed,
		note: "The five line up over the empty ring; one after another each card flies in and the ring fills from them, with a flash as each lands.",
		C: ScoreFeed,
	},
	{
		id: "score-cards-fan",
		section: "score",
		name: "A hand of brand cards folds into the ring",
		ms: SCORE_MS.fan,
		note: "The five arrive fanned like a hand of cards; the hand straightens and sinks into the ring as it fills.",
		C: ScoreFan,
	},
	{
		id: "recommendations-wall-fast",
		section: "recommendations",
		name: "Spotlight wall, fast: light, click, forward",
		ms: PICK_MS.fast,
		enter: "cut",
		note: "Round 5's wall, faster: the grey wall deals in, the light finds the pick in 1.5 s, a quick color punch with a ripple, and it flies forward. 'Picked for you.' with the real match and why.",
		C: PickFast,
	},
	{
		id: "recommendations-wall-pointer",
		section: "recommendations",
		name: "Spotlight wall with a pointer that taps",
		ms: PICK_MS.pointer,
		enter: "cut",
		note: "The Explorer tutorial's pointer rides the light from the right and taps the pick; the tap ripples, then the pick comes forward.",
		C: PickPointer,
	},
	{
		id: "recommendations-wall-dive",
		section: "recommendations",
		name: "Spotlight wall, then the camera dives in",
		ms: PICK_MS.dive,
		enter: "cut",
		note: "After the click the camera dives into the chosen cell: the wall grows past and the pick fills the hand-over frame.",
		C: PickDive,
	},
]
