// PROTOTYPE - throwaway. Round 5 intro clips, group "r5track": chapter 9 (keeps track for you) and chapter 10
// (your turn, and the quiz begins).
import type { Clip } from "../clip"
import { CloserGather, CloserPing, CloserShrink, CloserSlots, QUIZ_MS } from "./r5track/closer"
import { TrackingFeed, TrackingStages, TrackingWeek, TrackingWords } from "./r5track/tracking"
import "./r5track.css"

// The lab lists a section's clips newest first, so the order here is reversed on screen.
export const CLIPS: Clip[] = [
	{
		id: "tracking-week",
		section: "tracking",
		name: "Exploration: a week with GoodWatch",
		ms: 11000,
		note: "Seven days, one moment each: your IMDb ratings arrive, Want to See, it lands, next episode, waiting, pick up, start.",
		C: TrackingWeek,
	},
	{
		id: "tracking-words",
		section: "tracking",
		name: "Big words: Now. Pick up. Start.",
		ms: 14500,
		note: "Want it once, then each My shows group as one huge word over its show's backdrop, then the sources rain into the G.",
		C: TrackingWords,
	},
	{
		id: "tracking-feed",
		section: "tracking",
		name: "A feed that scrolls on",
		ms: 14000,
		note: "One column scrolls through the three moments while the words beside it change: Wishlist and the day it lands, My shows, your history.",
		C: TrackingFeed,
	},
	{
		id: "tracking-stages",
		section: "tracking",
		name: "Want it once → what's next → bring your ratings",
		ms: 14500,
		note: "Three stages that slide on: Want to See and the day it lands, My shows with Continue, Waiting, Pick up and Start, the import sources folding into the G.",
		C: TrackingStages,
	},
	{
		id: "closer-gather",
		section: "closer",
		name: "Exploration: the posters gather into the quiz",
		ms: QUIZ_MS,
		note: "The quiz's posters drift in a loose ring around \"Your turn!\", then settle into the grid. The quiz is real and playable.",
		C: CloserGather,
	},
	{
		id: "closer-ping",
		section: "closer",
		name: "Your turn! with a tap hint",
		ms: QUIZ_MS,
		note: "\"Your turn!\" over the quiz, then the Explorer tutorial's pointer taps the first poster. The quiz is real and playable.",
		C: CloserPing,
	},
	{
		id: "closer-slots",
		section: "closer",
		name: "Three slots fly into the quiz",
		ms: QUIZ_MS,
		note: "\"Your turn! Tap three you loved.\" with three empty slots that fly up into the quiz's own 1-2-3 as it opens.",
		C: CloserSlots,
	},
	{
		id: "closer-shrink",
		section: "closer",
		name: "Your turn! shrinks into the quiz",
		ms: QUIZ_MS,
		note: "\"Your turn!\" fills the screen, then shrinks to where the quiz's kicker sits while the posters deal in.",
		C: CloserShrink,
	},
]
