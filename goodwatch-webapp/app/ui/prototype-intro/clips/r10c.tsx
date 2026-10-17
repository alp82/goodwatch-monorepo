// PROTOTYPE - throwaway. Round 10 intro clips, group "r10c": tracking made shorter, and "bring your ratings" with an
// accelerating stream whose picks come out while it still runs. The owner on round 9: "tracking - make it shorter",
// "your ratings - accelerating the stream inside. and before its done it should start spitting out the results one by
// one". Both keep round 9's rhythm rules (no still stretch, a slow push-in during reading, ms = last motion).
import type { Clip } from "../clip"
import { FEED_R10_MS, TrackingFeedR10 } from "./r10c/feed"
import { IMPORTS_R10_MS, ImportsR10 } from "./r10c/imports"
import "./r7track.css"
import "./r8track.css"
import "./r9c.css"

export const CLIPS: Clip[] = [
	{
		id: "tracking-feed-r10",
		section: "tracking",
		name: "One feed, five moments, shorter",
		ms: FEED_R10_MS,
		note: "About 7 s instead of 10.5: five moments (Waiting for episodes goes), a tighter accelerating cadence, the movie's alert on Netflix, a short live hold on the line.",
		C: TrackingFeedR10,
	},
	{
		id: "imports-r10",
		section: "imports",
		name: "The stream speeds up, picks come out while it runs",
		ms: IMPORTS_R10_MS,
		note: "The sends come faster and faster (each gap 0.88 of the last, flights shortening), and halfway through the stream the G starts sending out the picks one by one, so intake and output overlap.",
		C: ImportsR10,
	},
]
