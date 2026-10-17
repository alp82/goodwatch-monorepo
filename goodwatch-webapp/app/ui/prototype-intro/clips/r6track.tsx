// PROTOTYPE - throwaway. Round 6 intro clips, group "r6track": chapter 9 (keeps track for you), chapter 10 (bring
// your ratings, its own chapter now) and chapter 11 (your turn, and the quiz begins).
import type { Clip } from "../clip"
import { CloserRoam, CloserRoamHint, QUIZ_MS } from "./r6track/closer"
import { FEED_MS, type FeedLook, TrackingFlow } from "./r6track/feed"
import { ImportsInto, ImportsStream } from "./r6track/imports"
import type { ClipProps } from "../clip"
import "./r6track.css"

const flow = (look: FeedLook) => (p: ClipProps) => <TrackingFlow {...p} look={look} />

// The lab lists a chapter's clips newest first, so each chapter's first pick is last here.
export const CLIPS: Clip[] = [
	{
		id: "tracking-flow-center",
		section: "tracking",
		name: "One feed, centred: each moment big, then in",
		ms: FEED_MS,
		note: "Each moment grows big over the middle, then shrinks into the bottom of one centred feed that keeps scrolling up.",
		C: flow({ layout: "center", big: "card" }),
	},
	{
		id: "tracking-flow-bleed",
		section: "tracking",
		name: "One feed, each moment on its own picture first",
		ms: FEED_MS,
		note: "Each moment first fills the screen with its title's picture and a short line, then its card shrinks into the feed.",
		C: flow({ layout: "center", big: "bleed" }),
	},
	{
		id: "tracking-flow",
		section: "tracking",
		name: "One feed: each moment big, then into its place",
		ms: FEED_MS,
		note: "Headline left, one feed right. Want it, it lands, next episode, waiting, pick up, start: each shows big, then takes its place as the feed scrolls on.",
		C: flow({ layout: "side", big: "card" }),
	},
	{
		id: "imports-stream",
		section: "imports",
		name: "Every source streams into the G",
		ms: 8200,
		note: "The importers as a list; each sends its titles along into the G; your picks deal in on the right.",
		C: ImportsStream,
	},
	{
		id: "imports-into",
		section: "imports",
		name: "Bring your ratings: into the G, picks out",
		ms: 7600,
		note: "Round 4's favourite, refined: eight big source tiles with names pour into the G, famous picks fan out on the other side.",
		C: ImportsInto,
	},
	{
		id: "closer-roam-hint",
		section: "closer",
		name: "Slots fly in, the pointer keeps trying posters",
		ms: QUIZ_MS,
		note: "The pointer hovers over random posters and shows a tap, again and again, without picking. Stops when you touch anything.",
		C: CloserRoamHint,
	},
	{
		id: "closer-roam",
		section: "closer",
		name: "Slots fly in, the pointer tries posters, then picks one",
		ms: QUIZ_MS,
		note: "Round 5's slots into the real quiz; then the pointer hovers over three random posters and picks a fourth for real (slot 1 fills, the taste starts). Stops when you touch anything.",
		C: CloserRoam,
	},
]
