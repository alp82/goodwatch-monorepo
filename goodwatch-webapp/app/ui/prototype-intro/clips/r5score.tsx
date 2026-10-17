// PROTOTYPE - throwaway. Round 5 intro clips, group "r5score": chapter 2 (One score) and chapter 3 (Picked for you).
// Chapter 2 clips end on RingEnd; chapter 3 clips start on it (enter: "cut") and end on the hero hand-over frame.
import type { Clip } from "../clip"
import { PickLoved, PickReel, PickShuffle, PickWall } from "./r5score/pick"
import { BEATS_MS, ScoreBeats, ScoreFlip, ScoreOrbit, ScorePulse } from "./r5score/score"
import "./r5score.css"

export const CLIPS: Clip[] = [
	{
		id: "score-orbit",
		section: "score",
		name: "Five line up, then orbit the ring",
		ms: 9000,
		note: "Five real numbers in a row, then they swing into an orbit around the ring while it fills. Ends on the frame chapter 3 starts from.",
		C: ScoreOrbit,
	},
	{
		id: "score-pulse",
		section: "score",
		name: "Five send their numbers into the ring",
		ms: 8800,
		note: "The five circle an empty ring from the start; one by one each sends a spark in, and the ring fills from them.",
		C: ScorePulse,
	},
	{
		id: "score-beats",
		section: "score",
		name: "One huge number at a time",
		ms: BEATS_MS,
		note: "Kinetic type: each source gets a full-screen beat with its logo and number, then all five orbit the ring as it fills.",
		C: ScoreBeats,
	},
	{
		id: "score-flip",
		section: "score",
		name: "Exploration: the poster turns into its score",
		ms: 9000,
		note: "The five circle The Dark Knight's poster like moons; the poster turns over and becomes its GoodWatch ring.",
		C: ScoreFlip,
	},
	{
		id: "recommendations-shuffle",
		section: "recommendations",
		name: "A deck shuffles, the top card turns: for you",
		ms: 9200,
		enter: "cut",
		note: "From the ring, posters deal into a deck, shuffle twice, and the top card turns over as the pick, with its real match and why.",
		C: PickShuffle,
	},
	{
		id: "recommendations-reel",
		section: "recommendations",
		name: "A reel of posters stops on yours",
		ms: 8900,
		enter: "cut",
		note: "From thousands of titles: a reel races past and slows down, stops on the pick, which grows into its place.",
		C: PickReel,
	},
	{
		id: "recommendations-loved",
		section: "recommendations",
		name: "You loved these, so this one",
		ms: 9000,
		enter: "cut",
		note: "The two titles you loved step up and move aside as the reason; candidates flicker in the middle and the pick lands.",
		C: PickLoved,
	},
	{
		id: "recommendations-wall",
		section: "recommendations",
		name: "Exploration: the sign-up wall finds yours",
		ms: 9300,
		enter: "cut",
		note: "A grey poster wall like the sign-up page; a light searches it, finds the pick in color, and it comes forward.",
		C: PickWall,
	},
]
