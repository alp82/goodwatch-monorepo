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
		if (!hydrated) return first
		const Loaded = (loaded ?? Lazy) as ComponentType<P>
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

// ---- The mini Explorer (slice 7): the map and an island are one screen's code, with the map's data.
export const ExplorerCode = screenCode(() => import("./screens/Explorer"))
/** The real mood map, for the Explorer's two screens. */
export const ExplorerData = screenCode<
	ComponentProps<typeof import("./screens/Explorer").ExplorerData>
>(() =>
	import("./screens/Explorer").then((code) => ({ default: code.ExplorerData })),
).Screen

/** Asks for the screens any key can open, so they are there by the first press. Called at the first interaction. */
export function loadFirstScreens() {
	for (const code of [MenuCode, AboutCode]) code.load().catch(() => {})
}
