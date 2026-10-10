// Home's doors (#385) are a chunk only a member whose home has them requests. This is how that code is asked for:
// by the TV as soon as it has mounted with doors in its data (`usePreloadHomeDoors`), and by the doors' first render.
//
// The doors are drawn after the page has hydrated, never by the server: a Suspense boundary in the server's markup
// is hydrated after the rest, and the TV's first state changes in between make React drop that markup and report
// React error 421. Until the code is there the home shows its head alone; once it is, the doors render without
// suspending.
import { type ComponentProps, type ReactNode, Suspense, lazy } from "react"
import { useHydrated } from "~/utils/hydrated"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

type Doors = typeof import("./HomeDoors").default

let loaded: Doors | null = null

export const loadHomeDoors = reloadOnStaleChunk(() =>
	import("./HomeDoors").then((module) => {
		loaded = module.default
		return module
	}),
)

const LazyDoors = lazy(loadHomeDoors)

/** The doors, once the page has hydrated and their code is there; `first` until then. */
export function HomeDoorsCode({
	first,
	...props
}: ComponentProps<Doors> & { first: ReactNode }) {
	const hydrated = useHydrated()
	if (!hydrated) return first
	const Loaded = loaded ?? LazyDoors
	return (
		<Suspense fallback={first}>
			<Loaded {...props} />
		</Suspense>
	)
}
