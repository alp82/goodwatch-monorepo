import { Suspense, lazy } from "react"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

// YouTube's player loads when this component first renders, so render it only after a click. A title page sends no
// request to YouTube before that. The frame is the one "Talked about now" plays (ui/social-embed), in a chunk that
// loads on that first render.
const YouTubeFrame = lazy(reloadOnStaleChunk(() => import("~/ui/social-embed/YouTubeFrame").then((m) => ({ default: m.YouTubeFrame }))))

/** A YouTube video that starts playing as soon as it has loaded. It fills its parent. */
export function YoutubePlayer({ videoKey }: { videoKey: string }) {
	return (
		<Suspense fallback={null}>
			<YouTubeFrame videoId={videoKey} title="YouTube video player" fill />
		</Suspense>
	)
}
