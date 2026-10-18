// "Talked about now" on a title page (#558), the featured layout settled in #542: one large video and a feed beside
// it. A title without a video leads with its best-ranked headline over its backdrop: the items come best-ranked first,
// all judged relevant (social-store.server.ts). Hidden when the title has none.
//
// Every item has a "wrong title?" control: the item goes at once, and the report hides it for everyone
// (POST /api/social/wrong-title). Loaded lazily by TalkedAboutNowSlot, once a visitor comes near.
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { type ReactNode, useMemo, useState } from "react"
import { SocialEmbed, type SocialEmbedItem } from "~/ui/social-embed/SocialEmbed"
import { ago, embedTarget, safeHref } from "~/ui/social-embed/target"
import { TmdbImage } from "~/ui/TmdbImage"
import type { SocialTitleRef, TitleBuzz, TitleSocial, TitleSocialQuery } from "./query"
import { reportWrongTitle } from "./report"

const FEED_SHOWN = 6
const HEADLINES_SHOWN = 4

const isVertical = (item: SocialEmbedItem) => {
	const target = embedTarget(item)
	return target.kind === "youtube" && target.vertical
}

/** Which item leads, and what goes in the feed and under the lead. */
export function arrange(items: SocialEmbedItem[], pickedVideo: string | null) {
	const videos = items.filter((item) => item.source === "youtube" && embedTarget(item).kind === "youtube")
	// A wide video leads before a Short: the lead slot is 16:9.
	const leadVideo = videos.find((video) => video.id === pickedVideo) ?? videos.find((video) => !isVertical(video)) ?? videos[0]
	const news = items.filter((item) => item.source === "news")
	const leadStory = leadVideo ? null : (news[0] ?? null)
	const posts = items.filter((item) => item.source === "bluesky" || item.source === "mastodon")
	const otherNews = news.filter((item) => item !== leadStory)
	// Posts make the feed beside the lead, and the headlines go under it. Without posts the headlines are the feed.
	return {
		videos,
		leadVideo: leadVideo ?? null,
		leadStory,
		feed: posts.length ? posts : otherNews,
		headlines: posts.length ? otherNews : [],
	}
}

const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" })

function summary(count: number, buzz: TitleBuzz | null) {
	const posts = `${count} ${count === 1 ? "post" : "posts"}, videos and headlines from the last 30 days`
	if (!buzz) return posts
	const lift = buzz.lift >= 10 ? Math.round(buzz.lift) : Math.round(buzz.lift * 10) / 10
	return `Read on Wikipedia ${lift}× as often as usual on ${DAY.format(new Date(`${buzz.day}T00:00:00Z`))} · ${posts}`
}

function WrongTitle({ name, onReport }: { name: string; onReport: () => void }) {
	return (
		<button
			type="button"
			onClick={onReport}
			title={`Not about ${name}? Hide it and tell us`}
			className="shrink-0 cursor-pointer text-xs text-gray-500 underline-offset-2 hover:text-gray-300 hover:underline"
		>
			Wrong title?
		</button>
	)
}

function LeadStory({ item, backdrop, actions }: { item: SocialEmbedItem; backdrop: string | null; actions: ReactNode }) {
	const href = safeHref(item.url)
	const body = (
		<>
			{item.image ? (
				<img src={item.image} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
			) : backdrop && (
				<TmdbImage
					kind="backdrop"
					path={backdrop}
					sizes={[["(min-width: 1024px)", "720px"], [null, "100vw"]]}
					maxWidth={780}
					className="absolute inset-0 h-full w-full object-cover"
					draggable={false}
				/>
			)}
			<span className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/10" />
			<span className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4 sm:p-5">
				<span className="text-xs font-semibold text-amber-200">
					{item.author} · {ago(item.publishedAt, Date.now())}
				</span>
				<span className="text-lg font-bold leading-snug text-white group-hover:underline sm:text-2xl">
					{item.text}
					{href && <span aria-hidden="true"> ↗︎</span>}
				</span>
			</span>
		</>
	)
	const box = "group relative block aspect-video overflow-hidden rounded-2xl bg-gray-900 ring-1 ring-white/10"
	return (
		<div className="flex flex-col gap-2" data-social-item={item.id}>
			{href ? (
				<a href={href} target="_blank" rel="noopener noreferrer" className={box}>
					{body}
				</a>
			) : (
				<div className={box}>{body}</div>
			)}
			<div className="flex justify-end">{actions}</div>
		</div>
	)
}

export default function TitleSocialSection({
	title,
	query,
	name,
	backdrop,
}: {
	title: SocialTitleRef
	/** The section's query, from the slot. */
	query: TitleSocialQuery
	name: string
	backdrop: string | null
}) {
	const queryClient = useQueryClient()
	const { data } = useQuery(query)
	const [pickedVideo, setPickedVideo] = useState<string | null>(null)
	const [feedOpen, setFeedOpen] = useState(false)
	const [headlinesOpen, setHeadlinesOpen] = useState(false)
	const [notice, setNotice] = useState<string | null>(null)
	const now = useMemo(() => Date.now(), [])

	const items = data?.items ?? []
	const { videos, leadVideo, leadStory, feed, headlines } = useMemo(() => arrange(items, pickedVideo), [items, pickedVideo])
	if (!items.length) return null

	const report = (item: SocialEmbedItem) => {
		// The item goes at once; the answer only decides whether it comes back.
		const remove = (previous: TitleSocial | undefined) =>
			previous && { ...previous, items: previous.items.filter((other) => other.id !== item.id) }
		const before = queryClient.getQueryData<TitleSocial>(query.queryKey)
		queryClient.setQueryData<TitleSocial | undefined>(query.queryKey, remove)
		setNotice(`Hidden “${item.text.slice(0, 80)}${item.text.length > 80 ? "…" : ""}”. Thanks for telling us.`)
		reportWrongTitle(title, item.id).catch(() => {
			if (before) queryClient.setQueryData(query.queryKey, before)
			setNotice("That report didn't go through. Please try again.")
		})
	}
	const wrong = (item: SocialEmbedItem) => <WrongTitle name={name} onReport={() => report(item)} />

	const shownFeed = feedOpen ? feed : feed.slice(0, FEED_SHOWN)
	const shownHeadlines = headlinesOpen ? headlines : headlines.slice(0, HEADLINES_SHOWN)

	return (
		<section id="talked-about-now" aria-labelledby="talked-about-now-heading" className="isolate flex flex-col items-center">
			<div className="flex w-full max-w-7xl flex-col gap-4 px-4 pt-12 sm:px-6 lg:px-8">
				<div>
					<h2 id="talked-about-now-heading" className="flex items-center gap-2 text-2xl font-bold">
						<span aria-hidden="true" className="relative flex h-2.5 w-2.5">
							<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60 motion-reduce:hidden" />
							<span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
						</span>
						Talked about now
					</h2>
					<p className="mt-1 text-sm text-gray-400">{summary(items.length, data?.buzz ?? null)}</p>
					<p aria-live="polite" className="mt-1 min-h-0 text-sm text-gray-300 empty:hidden">
						{notice}
					</p>
				</div>
				{/* A phone reads the lead, the feed, then the headlines; a wide screen puts the feed beside both. */}
				<div
					className={`grid grid-cols-1 items-start gap-6 ${
						feed.length ? "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr]" : "lg:max-w-4xl"
					}`}
				>
					<div className="flex min-w-0 flex-col gap-3">
						{leadVideo ? (
							<SocialEmbed
								key={leadVideo.id}
								item={leadVideo}
								art={backdrop}
								artSizes={[["(min-width: 1024px)", "720px"], [null, "100vw"]]}
								actions={wrong(leadVideo)}
								now={now}
							/>
						) : (
							leadStory && <LeadStory item={leadStory} backdrop={backdrop} actions={wrong(leadStory)} />
						)}
						{videos.length > 1 && (
							<div className="flex gap-2 overflow-x-auto pb-1" aria-label="Videos">
								{videos.map((video) => (
									<button
										type="button"
										key={video.id}
										onClick={() => setPickedVideo(video.id)}
										aria-pressed={video === leadVideo}
										className={`flex w-44 shrink-0 cursor-pointer flex-col gap-1 rounded-xl p-2 text-left text-xs ring-1 transition motion-reduce:transition-none ${
											video === leadVideo ? "bg-white/15 ring-white/40" : "bg-white/5 ring-white/10 hover:bg-white/10"
										}`}
									>
										<span className="line-clamp-2 font-semibold text-gray-100">{video.text}</span>
										<span className="truncate text-gray-400">
											{isVertical(video) ? "Short · " : ""}
											{video.author}
										</span>
									</button>
								))}
							</div>
						)}
					</div>
					{feed.length > 0 && (
						<div className="min-w-0 rounded-2xl bg-white/[.04] px-4 ring-1 ring-white/10 lg:col-start-2 lg:row-span-2 lg:row-start-1">
							<ul>
								{shownFeed.map((item) => (
									<li key={item.id} className="border-b border-white/10 py-3 last:border-0">
										<SocialEmbed item={item} variant="row" actions={wrong(item)} now={now} />
									</li>
								))}
							</ul>
							{feed.length > FEED_SHOWN && (
								<MoreButton open={feedOpen} hidden={feed.length - FEED_SHOWN} onClick={() => setFeedOpen(!feedOpen)} />
							)}
						</div>
					)}
					{headlines.length > 0 && (
						<div className="min-w-0 rounded-2xl bg-white/[.04] px-4 ring-1 ring-white/10 lg:col-start-1">
							<p className="pt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">More headlines</p>
							<ul>
								{shownHeadlines.map((item) => (
									<li key={item.id} className="border-b border-white/10 py-3 last:border-0">
										<SocialEmbed item={item} variant="row" actions={wrong(item)} now={now} />
									</li>
								))}
							</ul>
							{headlines.length > HEADLINES_SHOWN && (
								<MoreButton open={headlinesOpen} hidden={headlines.length - HEADLINES_SHOWN} onClick={() => setHeadlinesOpen(!headlinesOpen)} />
							)}
						</div>
					)}
				</div>
			</div>
		</section>
	)
}

function MoreButton({ open, hidden, onClick }: { open: boolean; hidden: number; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-expanded={open}
			className="mb-3 w-full cursor-pointer rounded-xl bg-white/5 py-2 text-sm font-semibold text-gray-200 hover:bg-white/10"
		>
			{open ? "Fewer" : `${hidden} more`}
		</button>
	)
}
