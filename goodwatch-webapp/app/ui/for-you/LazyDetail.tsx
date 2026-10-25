// A pick's quick view (ForYouQuickView.tsx) without its code in the page's first load: it loads when the page is
// interactive, and a press on a poster loads it too, so a first open doesn't wait for it.
import { Suspense, lazy, useEffect } from "react"
import { whenInteractive } from "~/utils/page-interactive"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

const load = () => import("./ForYouQuickView")
const ForYouQuickView = lazy(
	reloadOnStaleChunk(() =>
		load().then((module) => ({ default: module.ForYouQuickView })),
	),
)

/** Loads the quick view ahead of its first opening. */
export function preloadDetailSurfaces() {
	void load().catch(() => {})
}

/** The quick view's code, once the page is interactive. */
export function usePreloadDetailSurfaces() {
	useEffect(() => whenInteractive(preloadDetailSurfaces), [])
}

type Props = Omit<React.ComponentProps<typeof ForYouQuickView>, "openId"> & {
	openId: string | null
}

/** The open pick's quick view, while one is open. */
export function LazyQuickView({ openId, ...props }: Props) {
	if (openId === null) return null
	return (
		<Suspense fallback={null}>
			<ForYouQuickView openId={openId} {...props} />
		</Suspense>
	)
}
