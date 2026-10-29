// The title's videos for the opener's stage, in one order: trailers, then clips, then behind the scenes. Each has
// TMDB's name when the data has one, else its kind and place ("Trailer 2", "Clip 4"). Also what's playing now, which
// the stage writes and the title bar reads.
import { useSyncExternalStore } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"

type Media = MovieResult | ShowResult

export type VideoKind = "Trailer" | "Clip" | "Behind the scenes"

export interface Video {
	key: string
	kind: VideoKind
	/** TMDB's name for it, when the data has one. */
	name?: string
	/** Its place within its kind (1-based), and how many of its kind there are. */
	n: number
	of: number
}

export const VIDEO_KINDS: {
	field: "trailers" | "clips" | "featurettes"
	kind: VideoKind
	one: string
	many: string
}[] = [
	{ field: "trailers", kind: "Trailer", one: "trailer", many: "trailers" },
	{ field: "clips", kind: "Clip", one: "clip", many: "clips" },
	{
		field: "featurettes",
		kind: "Behind the scenes",
		one: "behind the scenes",
		many: "behind the scenes",
	},
]

/** Every video of the title: trailers, then clips, then behind the scenes. */
export function videosOf(media: Media): Video[] {
	const v = media.videos ?? { trailers: null, clips: null, featurettes: null }
	return VIDEO_KINDS.flatMap(({ field, kind }) => {
		const list = v[field] ?? []
		return list.map((item, i) => ({
			key: item.key,
			kind,
			...(item.name ? { name: item.name } : {}),
			n: i + 1,
			of: list.length,
		}))
	})
}

/** "Trailer 2", or "Trailer" when it's the only one of its kind. */
export const placeOf = (v: Video) => (v.of > 1 ? `${v.kind} ${v.n}` : v.kind)

/** Its name: TMDB's, else its place. */
export const nameOf = (v: Video) => v.name ?? placeOf(v)

/** The name inside a sentence: TMDB's in quotes, else the place in lower case ("Play trailer 2"). */
export const spokenName = (v: Video) =>
	v.name ? `“${v.name}”` : placeOf(v).toLowerCase()

/** "3 trailers · 6 clips · 21 behind the scenes" */
export function countsLine(videos: Video[]): string {
	return VIDEO_KINDS.map((k) => {
		const n = videos.filter((v) => v.kind === k.kind).length
		return n ? `${n} ${n === 1 ? k.one : k.many}` : null
	})
		.filter(Boolean)
		.join(" · ")
}

/** What the YouTube player is doing. */
export type PlayerState = "loading" | "playing" | "paused" | "ended"

export interface NowPlaying {
	name: string
	/** The name inside a sentence (spokenName). */
	spoken: string
	state: PlayerState
	/** Pause or resume. */
	toggle: () => void
	/** Scroll back up to the stage. */
	back: () => void
}

// One page plays at a time, so a module-level store is enough (the stage writes, the title bar reads).
let now: NowPlaying | null = null
const listeners = new Set<() => void>()
export function setNowPlaying(next: NowPlaying | null) {
	now = next
	for (const l of listeners) l()
}
const subscribe = (l: () => void) => {
	listeners.add(l)
	return () => listeners.delete(l)
}
export const useNowPlaying = () =>
	useSyncExternalStore(
		subscribe,
		() => now,
		() => null,
	)
