// Where a piece is from: the platform's mark and name, for the start row's head and the Hot on socials page.
import type { TalkedItem } from "~/domain/talked-about-now"

const PLATFORM: Record<TalkedItem["source"], string> = {
	youtube: "YouTube",
	bluesky: "Bluesky",
	mastodon: "Mastodon",
	rss: "News",
}

/** Where a piece is from, as a tiny mark: the platform's dot, a red play for YouTube, a sky bar for a headline. */
export function SourceMark({ source }: { source: TalkedItem["source"] }) {
	return <i className={`tn-mark tn-mark-${source}`} title={PLATFORM[source]} />
}

export function Platform({ source }: { source: TalkedItem["source"] }) {
	return (
		<span className="tn-platform">
			<SourceMark source={source} />
			{PLATFORM[source]}
		</span>
	)
}
