import { Suspense, lazy } from "react"

// The player library and YouTube's scripts load when this component first renders, so render it only
// after a click. A title page sends no request to YouTube before that.
const ReactPlayer = lazy(() => import("react-player/youtube"))

/** A YouTube video that starts playing as soon as it has loaded. It fills its parent. */
export function YoutubePlayer({ videoKey }: { videoKey: string }) {
	return (
		<Suspense fallback={null}>
			<ReactPlayer
				url={`https://www.youtube.com/watch?v=${videoKey}`}
				width="100%"
				height="100%"
				controls
				playing
				config={{ playerVars: { autoplay: 1 } }}
			/>
		</Suspense>
	)
}
