// PROTOTYPE - throwaway. The intro lab's contract: a clip is one short scene of the GoodWatch intro film, one of
// several variants of a section. The lab (routes/prototype.intro-lab.tsx) and the start page's film variant play
// any sequence of them.
//
// How a clip plays:
// - It fills the stage: an absolutely positioned box with `container-type: size`, about 16:9 (the TV's screen).
//   Size everything in cqw/cqh. It must also read on the phone's TV (about 360x300 px).
// - Its animations start when it mounts (CSS animation-delay from 0); the player remounts it to replay.
// - Every duration and delay is scaled by the stage's `--k` (1 at normal speed, larger is slower):
//   write `calc(900ms * var(--k))`, never a bare `900ms`. `ms` is the clip's nominal length at k = 1.
// - It enters on its own and holds its last frame; the player handles the hand-over to the next clip (cut, fade,
//   slide, wipe, ...) with an overlap at the end of `ms`.
// - Transform and opacity animations only (60 fps): no animated filter, blur, clip-path, width or box-shadow.
// - prefers-reduced-motion: show the clip's final frame (no motion).
// - Real data only (`IntroData`); nothing invented that reads as a real fact.
import type { ComponentType } from "react"
import type { LandingCard } from "~/server/prototype-landing.server"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import type { TvService } from "~/ui/living-room/tv/tv-home"

// The film's chapters, in the owner's order (round 5). `chapter` is the label on the chapter bar.
export const SECTIONS = [
	{ id: "opener", name: "The problem", chapter: "The problem" },
	{ id: "score", name: "One score", chapter: "One score" },
	{ id: "recommendations", name: "Picked for you", chapter: "For you" },
	{ id: "fingerprint", name: "How it feels (attributes)", chapter: "How it feels" },
	{ id: "search", name: "Search by feeling", chapter: "Search" },
	{ id: "filters", name: "Filters", chapter: "Filters" },
	{ id: "explorer", name: "Explorer", chapter: "Explorer" },
	{ id: "streaming", name: "Where it streams", chapter: "Streaming" },
	{ id: "tracking", name: "Keeps track for you", chapter: "Tracking" },
	{ id: "closer", name: "Your turn", chapter: "Your turn" },
] as const
export type SectionId = (typeof SECTIONS)[number]["id"]

export type IntroData = {
	/** The 16 start titles: popular now, posters. */
	startTitles: StartTitle[]
	/** The first 12 start titles as cards: score, services (Germany locally), backdrop, three mood words. */
	landing: LandingCard[]
	/** A guest's two services. */
	services: TvService[]
	/**
	 * Round 5: the titles every clip should use. The best-known good movies and shows (most votes, 70+, no talk
	 * shows), movies and shows alternating, as cards with score, services (Germany locally), backdrop and mood words.
	 * `pool[0]` is the hero: the title the pick (chapter 3) lands on and the attributes (chapter 4) start from.
	 */
	pool: LandingCard[]
	/** What each clip group's own loader added (server/prototype-intro/<group>.server.ts), by group. */
	extra: Record<string, unknown>
}

export type ClipProps = { data: IntroData }

export type Clip = {
	/** `<section>-<short>`, unique: "score-merge". */
	id: string
	section: SectionId
	/** A few words for the lab's list: "Logos merge into the ring". */
	name: string
	/** Nominal length at k = 1, including the hold on its last frame. */
	ms: number
	/** One line on what it tries, for the lab. */
	note?: string
	/**
	 * How it takes over from the clip before it, instead of the lab's chosen hand-over: "cut" for a clip whose first
	 * frame continues the previous clip's last frame (a planned hand-over between chapters).
	 */
	enter?: "cut" | "fade" | "slide" | "zoom" | "wipe" | "deal"
	/** Round 4 clips the owner passed on: hidden in the lab unless "Show older clips" is on. */
	archived?: boolean
	C: ComponentType<ClipProps>
}
