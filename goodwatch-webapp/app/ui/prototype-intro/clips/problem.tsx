// PROTOTYPE - throwaway. Intro clips of group "problem": the openers (an evening lost to choosing) and the
// sign-offs. The scenes are in problem/scenes.tsx.
import type { Clip } from "../clip"
import {
	CloserFree,
	CloserTurn,
	CloserWall,
	CloserWordmark,
	OpenerApps,
	OpenerChat,
	OpenerRemote,
	OpenerScroll,
} from "./problem/scenes"
import "./problem.css"

export const CLIPS: Clip[] = [
	{
		id: "opener-scroll",
		section: "opener",
		name: "Endless scroll, the evening passing",
		ms: 6500,
		note: "E's poster wall, slower and calmer; a clock rolls from 8:12 pm to 10:58 pm.",
		C: OpenerScroll,
	},
	{
		id: "opener-chat",
		section: "opener",
		name: "\"What should we watch?\" chat",
		ms: 7200,
		note: "Real titles suggested and turned down in a chat, then \"Every night, the same question.\"",
		C: OpenerChat,
	},
	{
		id: "opener-apps",
		section: "opener",
		name: "Five apps, five lists",
		ms: 6800,
		note: "Real service logos, each over its own drifting column of posters.",
		C: OpenerApps,
	},
	{
		id: "opener-remote",
		section: "opener",
		name: "Click, click, click until 11:47 pm",
		ms: 7000,
		note: "A row of tiles steps past a focus ring while the clock runs late.",
		C: OpenerRemote,
	},
	{
		id: "closer-wordmark",
		section: "closer",
		name: "Wordmark, \"Find something good.\"",
		ms: 4800,
		note: "The GoodWatch wordmark lands in a warm light.",
		C: CloserWordmark,
	},
	{
		id: "closer-wall",
		section: "closer",
		name: "Spotlight wall, \"your next favorite\"",
		ms: 6800,
		note: "The sign-up wall: posters deal in grey, a light settles on the best-scored one, which turns to color.",
		C: CloserWall,
	},
	{
		id: "closer-turn",
		section: "closer",
		name: "\"Your turn.\" into tap three",
		ms: 4800,
		note: "Three empty slots deal in: hands over to the tap-three screen.",
		C: CloserTurn,
	},
	{
		id: "closer-free",
		section: "closer",
		name: "\"Free.\" No account needed",
		ms: 5000,
		note: "Wordmark small, \"Free.\" huge, then the start button.",
		C: CloserFree,
	},
]
