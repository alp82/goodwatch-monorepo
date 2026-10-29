// The intro's building blocks: a scene is one short part of the film the start page's TV plays for a guest
// (docs/implementation/home-intro.md). The player (player.tsx) plays the scenes of film.ts one after another.
//
// How a scene plays:
// - It fills the stage: an absolutely positioned box with `container-type: size`, about 16:9 (the TV's picture).
//   Everything is sized in cqw/cqh, and it also reads on the phone's TV (about 360x300 px).
// - Its animations start when it mounts (CSS animation-delay from 0); the player mounts it again to replay.
// - Every duration and delay is scaled by the stage's `--k`: `calc(900ms * var(--k))`, never a bare `900ms`. `ms` is
//   the scene's length at k = 1.
// - It enters by itself and holds its last frame; the player hands over to the next scene with an overlap at the
//   end of `ms`.
// - Transform and opacity animations only: no animated filter, blur, clip-path, width or box-shadow.
// - With reduced motion it shows its last frame.
// - Real data only (`IntroData`). A member's moment (an alert, a seen title) is labelled as an example.
import type { ComponentType } from "react"
import type { IntroCard } from "./data"

/** The film's chapters in order, with the label the chapter bar shows. The quiz ends the film and isn't one. */
export const CHAPTERS = [
	{ id: "opener", name: "Let's watch" },
	{ id: "score", name: "One score" },
	{ id: "streaming", name: "Streaming" },
	{ id: "recommendations", name: "For you" },
	{ id: "fingerprint", name: "Your taste" },
	{ id: "search", name: "Search" },
	{ id: "filters", name: "Filters" },
	{ id: "tracking", name: "Tracking" },
	{ id: "imports", name: "Your ratings" },
	{ id: "ai", name: "Use with AI" },
	{ id: "discord", name: "Discord bot" },
	{ id: "closer", name: "Your turn" },
] as const
export type ChapterId = (typeof CHAPTERS)[number]["id"]

/** The intro's data, as /api/intro answers it (server/living-room/intro). */
export type IntroData = {
	/**
	 * The titles the scenes show: well-known, well-rated movies and shows, movies and shows alternating, with their
	 * score, services in the visitor's country, backdrop and three feeling words. The first is Interstellar.
	 */
	pool: IntroCard[]
	/**
	 * Each scene's own content, by name (server/living-room/intro/content.json), with `shows`: popular modern shows
	 * as cards, like the pool's.
	 */
	extra: Record<string, unknown>
}

export type SceneProps = { data: IntroData }

/** How a scene takes over from the one before it. */
export type Enter = "cut" | "fade" | "wipe" | "deal"

export type Scene = {
	id: string
	section: ChapterId
	/** Length at k = 1, including the hold on its last frame. */
	ms: number
	/** How it takes over from the scene before it; a crossfade by default. "cut" continues the last frame. */
	enter?: Enter
	/**
	 * The closer counts as a chapter: the chapter bar and Next stay on it, and Next steps past it. For an end card
	 * that goes on by itself (the start page's Your turn); the TV's quiz waits for the visitor and isn't one.
	 */
	chapter?: boolean
	C: ComponentType<SceneProps>
}
