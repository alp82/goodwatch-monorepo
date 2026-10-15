// The featured title's pieces as they are on their platforms: a video, a post, a headline, each behind the click-to-load
// facade the title page shares (ui/social-embed, #558). Before the press nothing reaches a third party: a video shows
// the title's own TMDB backdrop, a post its stored text, a headline is a plain link to the publisher.
import type { TalkedItem } from "~/domain/talked-about-now"
import {
	SocialEmbed,
	type SocialEmbedItem,
} from "~/ui/social-embed/SocialEmbed"

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

const embedOf = (item: TalkedItem): SocialEmbedItem => ({
	id: item.id,
	source: item.source === "rss" ? "news" : item.source,
	url: item.url,
	sourceId: item.sourceId,
	author: item.publisher,
	publishedAt: item.at,
	text: item.text,
})

/** The featured title's pieces: the video on top, the others side by side (a strip to swipe on a phone). */
export function NativeItems({
	items,
	still,
}: { items: TalkedItem[]; still: string | null }) {
	const now = Date.now()
	const video = items.find((item) => item.source === "youtube")
	const rest = items.filter((item) => item !== video)
	return (
		<>
			{video && (
				<SocialEmbed
					item={embedOf(video)}
					art={still}
					artSizes={[
						["(min-width: 1024px)", "640px"],
						[null, "100vw"],
					]}
					now={now}
				/>
			)}
			{rest.length > 0 && (
				<div className={`tn-cards${rest.length > 1 ? " tn-cards-two" : ""}`}>
					{rest.map((item) => (
						<SocialEmbed
							key={item.id}
							item={embedOf(item)}
							now={now}
							className="h-full"
						/>
					))}
				</div>
			)}
		</>
	)
}
