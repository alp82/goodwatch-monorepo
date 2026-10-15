// YouTube's own player from youtube-nocookie.com, on its own so that the title page's trailer dialog and Media
// section (ui/details/YoutubePlayer.tsx) don't bring the other players into the page's first view.
// YouTube refuses to play an embed without a referrer, so the frame sends the page's origin.
export const REFERRER_POLICY = "strict-origin-when-cross-origin"

/** A YouTube video from youtube-nocookie.com that starts at once. Fills its parent with `fill`, else 16:9 or 9:16. */
export function YouTubeFrame({
	videoId,
	title,
	vertical = false,
	fill = false,
}: {
	videoId: string
	title: string
	vertical?: boolean
	fill?: boolean
}) {
	const shape = fill ? "h-full" : vertical ? "aspect-[9/16]" : "aspect-video"
	return (
		<iframe
			src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0&playsinline=1`}
			title={title}
			allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
			referrerPolicy={REFERRER_POLICY}
			allowFullScreen
			className={`block w-full border-0 bg-black ${shape}`}
		/>
	)
}
