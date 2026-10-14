import { YouTubeFrame } from "~/ui/social-embed/players"

// YouTube's player loads when this component first renders, so render it only after a click. A title page sends no
// request to YouTube before that. The same frame plays the videos of "Talked about now" (ui/social-embed).

/** A YouTube video that starts playing as soon as it has loaded. It fills its parent. */
export function YoutubePlayer({ videoKey }: { videoKey: string }) {
	return <YouTubeFrame videoId={videoKey} title="YouTube video player" fill />
}
