// PROTOTYPE - throwaway. Round 7 intro clips, group "r7track": chapter 9 (keeps track for you), chapter 10 (bring
// your ratings) and chapter 11 (your turn, and the quiz begins). One polished clip per chapter, from the owner's
// picks: tracking-flow, imports-into and closer-slots.
import type { Clip } from "../clip"
import { CloserRipples, QUIZ_MS } from "./r7track/closer"
import { FEED_MS, TrackingFlow } from "./r7track/feed"
import { IMPORTS_MS, ImportsFlow } from "./r7track/imports"
import "./r7track.css"

export const CLIPS: Clip[] = [
	{
		id: "tracking-feed-r7",
		section: "tracking",
		name: "One feed, each moment big, faster and faster",
		ms: FEED_MS,
		note: "Round 6's tracking-flow: each moment shows big, then takes its place as the feed scrolls on; each one comes a little sooner than the last. New copy: \"You watch. We keep track.\"",
		C: TrackingFlow,
	},
	{
		id: "imports-flow-r7",
		section: "imports",
		name: "Real logos stream their titles into the G",
		ms: IMPORTS_MS,
		note: "Round 6's imports-into: the eight sources (real logos) stay on the left and stream their titles into the G; your picks come out on the right.",
		C: ImportsFlow,
	},
	{
		id: "closer-ripples-r7",
		section: "closer",
		name: "Slots fly in, then tap ripples on random posters",
		ms: QUIZ_MS,
		note: "Round 5's closer-slots into the real quiz; then a soft tap ripple on a random poster about every second, never picking. Stops at the first touch.",
		C: CloserRipples,
	},
]
