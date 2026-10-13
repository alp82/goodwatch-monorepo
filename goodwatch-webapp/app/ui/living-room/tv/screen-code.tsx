// The TV's screens that are needed only after an interaction are chunks of their own: the menu and What is
// GoodWatch? here, and each mini app's screens as its slice adds them. This is how such a chunk is asked for and
// drawn (the pattern of home-doors-code.tsx).
//
// A lazy screen is drawn after the page has hydrated, never by the server: a Suspense boundary in the server's
// markup is hydrated after the rest, and the TV's first state changes in between make React drop that markup and
// report React error 421. Until the code is there the screen shows `first`; once it is, it renders without
// suspending.
import { type ComponentType, type ReactNode, Suspense, lazy } from "react"
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

/** Asks for the screens any key can open, so they are there by the first press. Called at the first interaction. */
export function loadFirstScreens() {
	for (const code of [MenuCode, AboutCode]) code.load().catch(() => {})
}
