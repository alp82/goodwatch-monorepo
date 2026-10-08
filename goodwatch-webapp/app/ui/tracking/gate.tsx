// Episode tracking on the show page (#384), as far as the page's first view knows of it: whether the viewer gets
// it, the status box a tracked show paints from the member data, and the two places where the rest loads on first
// use. Everything else (the state machine, the show's rows, the hero box, the episode list) is in chunks that only
// a member with REC_TRACKING requests, after the page is up.
import {
	type CSSProperties,
	type ReactNode,
	Suspense,
	lazy,
	useEffect,
	useRef,
	useState,
} from "react"
import { useFeature } from "~/hooks/useFeature"
import { useWatchState } from "~/hooks/useUserDataAccessors"
import type { WatchStateEntry } from "~/types/user-data"
import { useUser } from "~/utils/auth"
import { onFirstInteraction } from "~/utils/first-interaction"
import { useHydrated } from "~/utils/hydrated"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

const HeroTracking = lazy(reloadOnStaleChunk(() => import("./HeroTracking")))
const loadEpisodeList = reloadOnStaleChunk(() => import("./EpisodeList"))
const EpisodeList = lazy(loadEpisodeList)

/** Sent on `window` when something asks for the episode list, so that the page loads its code. */
export const OPEN_EPISODES_EVENT = "gw:open-episodes"

/** What tracking reads of a title. `MovieResult` and `ShowResult` have it. */
export interface TrackedMedia {
	mediaType: "movie" | "show"
	details: { tmdb_id: number; title: string; in_production?: boolean }
}

/** Whether the viewer gets episode tracking on this title's page: a member, on a show, while REC_TRACKING shows it. */
export function useEpisodeTracking(media: TrackedMedia): boolean {
	const enabled = useFeature("tracking")
	const { user } = useUser()
	return enabled && Boolean(user) && media.mediaType === "show"
}

type Status = WatchStateEntry["state"]

export const STATUS_LOOK: Record<Status, { word: string; pill: string }> = {
	watching: { word: "Watching", pill: "bg-sky-500 text-black" },
	on_hold: { word: "On hold", pill: "bg-violet-500 text-white" },
	dropped: { word: "Dropped", pill: "bg-pink-500 text-black" },
	seen: { word: "Seen", pill: "bg-green-500 text-black" },
}

/** The frame of the hero's status box, at the height the box has once its content is there. */
export function StatusBoxFrame({ children }: { children: ReactNode }) {
	return (
		<div
			data-tracking-box
			className="mb-4 flex min-h-[8.375rem] flex-col justify-center rounded-xl bg-white/[0.08] p-3 ring-1 ring-white/10"
		>
			{children}
		</div>
	)
}

/** The status box as the first paint has it: the state from the member data, and room for the rest. */
function StatusBoxFirstPaint({
	state,
	running,
}: {
	state: Status
	running: boolean
}) {
	const look = STATUS_LOOK[state]
	return (
		<StatusBoxFrame>
			<span
				className={`inline-flex h-9 w-fit items-center rounded-lg px-2.5 text-xs font-semibold ${look.pill}`}
			>
				{state === "seen" && running ? "Caught up" : look.word}
			</span>
			<span className="mt-3 block h-1.5 rounded-full bg-white/10" />
			<span className="mt-3 block h-11" />
		</StatusBoxFrame>
	)
}

/**
 * The hero's title actions for a member with tracking. The first paint is today's action set, under the status box
 * when the member data says the show has a state. The tracking code then loads and takes over in place.
 */
export function TrackedTitleActions({
	media,
	children,
}: {
	media: TrackedMedia
	/** Today's title action set. */
	children: ReactNode
}) {
	const entry = useWatchState("show", media.details.tmdb_id)
	const hydrated = useHydrated()
	const first = (
		<>
			{entry && (
				<StatusBoxFirstPaint
					state={entry.state}
					running={media.details.in_production === true}
				/>
			)}
			{children}
		</>
	)
	if (!hydrated) return first
	return (
		<Suspense fallback={first}>
			<HeroTracking media={media} first={first} />
		</Suspense>
	)
}

/**
 * The page's episodes section for a member with tracking. It shows today's episode grid until the member comes
 * near it or asks for the episode list; then the list's code loads, and the list takes the grid's place when the
 * show has one.
 */
export function TrackedEpisodes({
	media,
	wrapper,
	children,
}: {
	media: TrackedMedia
	/** The section's wrapper on the title page: its class and reserved height. */
	wrapper: { className?: string; style?: CSSProperties }
	/** Today's episode grid, or nothing for a show without one. */
	children: ReactNode
}) {
	const section = useRef<HTMLDivElement>(null)
	const [wanted, setWanted] = useState(false)
	useEffect(() => {
		const want = () => setWanted(true)
		window.addEventListener(OPEN_EPISODES_EVENT, want)
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) want()
			},
			{ rootMargin: "800px 0px" },
		)
		if (section.current) observer.observe(section.current)
		// The code is fetched at the first sign of use, so the list is there when the member reaches it.
		onFirstInteraction(() => void loadEpisodeList().catch(() => {}))
		return () => {
			window.removeEventListener(OPEN_EPISODES_EVENT, want)
			observer.disconnect()
		}
	}, [])
	return (
		// With neither a grid nor a list the section is empty, and must not leave the page's gap between sections.
		<div
			ref={section}
			{...wrapper}
			className={`${wrapper.className ?? ""} empty:-mb-12`}
		>
			{wanted ? (
				<Suspense fallback={children}>
					<EpisodeList media={media}>{children}</EpisodeList>
				</Suspense>
			) : (
				children
			)}
		</div>
	)
}
