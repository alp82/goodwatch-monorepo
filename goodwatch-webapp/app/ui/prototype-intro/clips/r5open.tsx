// PROTOTYPE - throwaway. Round 5 intro clips, group "r5open": chapter 1, the problem. The chat ("What should we
// watch?") turns into endless scrolling while the evening visibly passes.
import type { Clip } from "../clip"
import { OpenerClock, OpenerNight, OpenerPhone, OpenerStopwatch } from "./r5open/scenes"
import "./r5open.css"

export const CLIPS: Clip[] = [
	{
		id: "opener-clock",
		section: "opener",
		name: "Chat, then the wall, an analog clock sweeps",
		ms: 10500,
		note: "Owner's direction: the chat steps back as the endless wall rises behind it; a clock's hands sweep 8 pm to 11 pm across both.",
		C: OpenerClock,
	},
	{
		id: "opener-night",
		section: "opener",
		name: "Night falls, the chat scrolls into the wall",
		ms: 10500,
		note: "Dusk turns to night in the window (sun sets, moon and stars rise); the chat scrolls up and the wall follows in one thumb motion.",
		C: OpenerNight,
	},
	{
		id: "opener-phone",
		section: "opener",
		name: "Phone battery drains, we fall into the feed",
		ms: 11000,
		note: "The chat on a phone, its clock and battery running down; the chat scrolls into a poster feed, then the phone dives toward us and the feed fills the TV.",
		C: OpenerPhone,
	},
	{
		id: "opener-stopwatch",
		section: "opener",
		name: "Exploration: a stopwatch and a pile of no's",
		ms: 10000,
		note: "A stopwatch counts the time spent choosing; every rejected title is tossed on a pile, and the pile becomes a wall of crossed-out posters.",
		C: OpenerStopwatch,
	},
]
