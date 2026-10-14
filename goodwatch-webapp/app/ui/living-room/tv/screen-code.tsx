// The TV's screens that are needed only after an interaction are chunks of their own: the menu and What is
// GoodWatch? here, and each mini app's screens as its slice adds them. This is how such a chunk is asked for and
// drawn (the pattern of home-doors-code.tsx).
//
// TvScreen.tsx alone imports this file, and the scene takes what it needs of it from there. With a second importer
// the build would count this small module as shared and move it into the shell of every page, with the name of
// every lazy chunk in it (vite.config.js, rule 3 of the client chunks).
//
// A lazy screen is drawn after the page has hydrated, never by the server: a Suspense boundary in the server's
// markup is hydrated after the rest, and the TV's first state changes in between make React drop that markup and
// report React error 421. Until the code is there the screen shows `first`; once it is, it renders without
// suspending.
import {
	type ComponentProps,
	type ComponentType,
	type ReactNode,
	Suspense,
	lazy,
	useRef,
} from "react"
import { useHydrated } from "~/utils/hydrated"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

/** A screen in a chunk of its own: `load` asks for the chunk, `Screen` draws it or `first` until it is there. */
export function screenCode<P extends object>(
	importer: () => Promise<{ default: ComponentType<P> }>,
) {
	let loaded: ComponentType<P> | null = null
	const load = reloadOnStaleChunk(() =>
		importer().then((module) => {
			loaded = module.default
			return module
		}),
	)
	const Lazy = lazy(load)
	function Screen({ first = null, ...props }: P & { first?: ReactNode }) {
		const hydrated = useHydrated()
		// What this screen was first drawn with stays what it is drawn with. Its code arrives while it is on show,
		// and drawing the loaded component in place of `Lazy` from then on would be another component to React: the
		// screen would be mounted a second time, and a data component would ask for its data twice.
		const drawn = useRef<ComponentType<P> | null>(null)
		if (!hydrated) return first
		drawn.current ??= (loaded ?? Lazy) as ComponentType<P>
		const Loaded = drawn.current
		return (
			<Suspense fallback={first}>
				<Loaded {...(props as P)} />
			</Suspense>
		)
	}
	return { load, Screen }
}

export const MenuCode = screenCode(() => import("./screens/Menu"))
export const AboutCode = screenCode(() => import("./screens/About"))
// Tonight draws with the title screen's parts, so its chunk brings the title screen's along: Details finds it there.
export const TonightCode = screenCode(() => import("./screens/Tonight"))
export const TitleCode = screenCode(() => import("./screens/Title"))
export const RateCode = screenCode(() => import("./screens/Rate"))

// A screen's data hook is in the screen's chunk too, as a component that draws nothing and reports up to the
// scene ("How a screen loads its data", docs/implementation/tv-screen-revamp/tonight-title/README.md).
/** The title's card, marks and effects, for the title screen and the rating. */
export const TitleData = screenCode<
	ComponentProps<typeof import("./screens/Title").TitleData>
>(() =>
	import("./screens/Title").then((code) => ({ default: code.TitleData })),
).Screen

// Mini Discover: its tabs, the titles of one choice, and the titles' data.
export const DiscoverCode = screenCode(() => import("./screens/Discover"))
/** The titles of the choice on mini Discover. */
export const DiscoverData = screenCode<
	ComponentProps<typeof import("./screens/Discover").DiscoverData>
>(() =>
	import("./screens/Discover").then((code) => ({
		default: code.DiscoverData,
	})),
).Screen

// ---- The mini Explorer (slice 7): the map and an island are one screen's code, with the map's data.
export const ExplorerCode = screenCode(() => import("./screens/Explorer"))
/** The real mood map, for the Explorer's two screens. */
export const ExplorerData = screenCode<
	ComponentProps<typeof import("./screens/Explorer").ExplorerData>
>(() =>
	import("./screens/Explorer").then((code) => ({ default: code.ExplorerData })),
).Screen

// Slice 8: Taste, and the taste quiz. The quiz and the rating draw with the same strip (RatingStrip.tsx).
export const TasteCode = screenCode(() => import("./screens/Taste"))
export const QuizCode = screenCode(() => import("./screens/Quiz"))
/** The person's taste and the quiz behind Taste, a side's screen and the quiz. */
export const TasteData = screenCode<
	ComponentProps<typeof import("./screens/Taste").TasteData>
>(() =>
	import("./screens/Taste").then((code) => ({ default: code.TasteData })),
).Screen

// My shows (slice 9): the screen, what is new for the member's shows, and the Next episode of a show on the title
// screen. The last is a chunk of its own: it brings the show page's tracking code, which only a member on a show's
// title screen needs.
export const ShowsCode = screenCode(() => import("./screens/Shows"))
/** What is new for a member's shows: the New episodes signal. */
export const ShowsData = screenCode<
	ComponentProps<typeof import("./screens/Shows").ShowsData>
>(() =>
	import("./screens/Shows").then((code) => ({ default: code.ShowsData })),
).Screen
export const EpisodeCode = screenCode(() => import("./screens/ShowEpisode"))
/** The Next episode of a member's show on the title screen, and its mark. */
export const EpisodeData = EpisodeCode.Screen

/** Asks for the screens any key can open, so they are there by the first press. Called at the first interaction. */
export function loadFirstScreens() {
	for (const code of [MenuCode, AboutCode]) code.load().catch(() => {})
}
