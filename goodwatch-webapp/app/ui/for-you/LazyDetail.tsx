// The pick's detail surfaces, the phone title drawer and the desktop pop-out card, without their code in the page's
// first load: they load on first use (with the detail, the swipes and the focus handling). The code for this screen
// size loads when the page is interactive, and a press on a poster loads it too, so a first open doesn't wait for it.
// Each surface mounts with its first opening and stays, so closing can still animate.
import { Suspense, lazy, useEffect } from "react"
import { useOpenedOnce } from "~/utils/first-use"
import { whenInteractive } from "~/utils/page-interactive"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

const loadDrawer = () => import("./TitleDrawer")
const loadCard = () => import("./PopOutCard")
const TitleDrawer = lazy(
	reloadOnStaleChunk(() =>
		loadDrawer().then((module) => ({ default: module.TitleDrawer })),
	),
)
const PopOutCard = lazy(
	reloadOnStaleChunk(() =>
		loadCard().then((module) => ({ default: module.PopOutCard })),
	),
)

const desk = () => window.matchMedia("(min-width: 1024px)").matches

/** Loads the detail surface for this screen size ahead of its first opening. */
export function preloadDetailSurfaces() {
	void (desk() ? loadCard() : loadDrawer()).catch(() => {})
}

type DrawerProps = React.ComponentProps<typeof TitleDrawer>
type CardProps = React.ComponentProps<typeof PopOutCard>

/** The surfaces' code, once the page is interactive. */
export function usePreloadDetailSurfaces() {
	useEffect(() => whenInteractive(preloadDetailSurfaces), [])
}

export function LazyTitleDrawer(props: DrawerProps) {
	const opened = useOpenedOnce(props.openId !== null)
	if (!opened) return null
	return (
		<Suspense fallback={null}>
			<TitleDrawer {...props} />
		</Suspense>
	)
}

export function LazyPopOutCard(props: CardProps) {
	const opened = useOpenedOnce(props.enabled && props.openId !== null)
	if (!opened) return null
	return (
		<Suspense fallback={null}>
			<PopOutCard {...props} />
		</Suspense>
	)
}
