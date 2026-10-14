// PROTOTYPE - throwaway. Four ways to lay out "Talked about now" on a title page. Each one is free to throw out the
// others' structure; they share only the facade pieces in embeds.tsx.
//   rail     - one mixed horizontal rail, every source in one row
//   grouped  - a grid grouped by platform, one block per source, with "load all" per platform
//   featured - one featured video, then a feed of posts and headlines beside it
//   lab      - not a layout: every source side by side, facade and player, with the measured cost of each
import { useContext, useMemo, useState } from "react"
import costs from "./costs.json"
import {
	ItemCard,
	NewsCard,
	Player,
	SampleTag,
	SectionContext,
	SectionHeading,
	SourceChip,
	actionLabel,
	consentLine,
	shapeOf,
	useLoaded,
} from "./embeds"
import { ITEMS, SOURCE_ORDER, type SocialItem, type SourceKey, TITLE, VENDORS, ago } from "./social"

type LayoutProps = { items: SocialItem[] }

// --- A: rail ---

/** Interleaves sources so neighbours differ: a video, a post, a vertical clip, a headline, ... */
function mixed(items: SocialItem[]) {
	const bySource = new Map<SourceKey, SocialItem[]>()
	for (const item of items) bySource.set(item.source, [...(bySource.get(item.source) ?? []), item])
	const order: SourceKey[] = ["youtube", "bluesky", "short", "news", "tiktok", "threads", "reel", "mastodon", "facebook", "reddit"]
	const out: SocialItem[] = []
	while (out.length < items.length) {
		for (const source of order) {
			const next = bySource.get(source)?.shift()
			if (next) out.push(next)
		}
	}
	return out
}

function RailCard({ item }: { item: SocialItem }) {
	const [loaded] = useLoaded(item.id)
	const shape = shapeOf(item)
	// A loaded Instagram embed needs 326 px; other vertical players keep the facade's width.
	const width =
		item.source === "news"
			? "w-[78vw] sm:w-64"
			: shape === "video"
				? "w-[85vw] sm:w-[26rem]"
				: shape === "vertical"
					? loaded && item.source === "reel"
						? "w-[85vw] sm:w-[22rem]"
						: "w-[60vw] sm:w-56"
					: loaded
						? "w-[85vw] sm:w-[22rem]"
						: "w-[78vw] sm:w-72"
	return (
		<div className={`shrink-0 snap-start ${width}`}>
			<ItemCard item={item} className={item.source === "news" || shape === "text" ? "min-h-[15rem]" : ""} />
		</div>
	)
}

export function RailLayout({ items }: LayoutProps) {
	const ordered = useMemo(() => mixed(items), [items])
	const [rail, setRail] = useState<HTMLDivElement | null>(null)
	const scroll = (dir: number) => rail?.scrollBy({ left: dir * rail.clientWidth * 0.8, behavior: "smooth" })
	return (
		<section className="flex flex-col gap-4">
			<SectionHeading why={TITLE.why} count={items.length}>
				<div className="hidden gap-2 sm:flex">
					<button type="button" onClick={() => scroll(-1)} aria-label="Scroll back" className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20">
						←
					</button>
					<button type="button" onClick={() => scroll(1)} aria-label="Scroll on" className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20">
						→
					</button>
				</div>
			</SectionHeading>
			<div ref={setRail} className="-mx-4 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto scroll-px-4 px-4 pb-3 [scrollbar-width:thin] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
				{ordered.map((item) => (
					<RailCard key={item.id} item={item} />
				))}
			</div>
		</section>
	)
}

// --- B: grouped by platform ---

function LoadAll({ items }: { items: SocialItem[] }) {
	const { loaded, load } = useContext(SectionContext)
	const waiting = items.filter((item) => !loaded.has(item.id))
	if (items[0].source === "news" || waiting.length < 2) return null
	return (
		<button type="button" onClick={() => waiting.forEach((item) => load(item.id))} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gray-200 hover:bg-white/20" title={consentLine(items[0].source)}>
			Load all {waiting.length}
		</button>
	)
}

function Group({ source, items, className = "", cols = "" }: { source: SourceKey; items: SocialItem[]; className?: string; cols?: string }) {
	return (
		<div className={`flex flex-col gap-3 ${className}`}>
			<div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
				<span className="flex items-center gap-2">
					<SourceChip source={source} className="text-sm" />
					<span className="text-xs text-gray-500">{items.length}</span>
				</span>
				<LoadAll items={items} />
			</div>
			<div className={`grid gap-3 ${cols}`}>
				{items.map((item) => (
					<ItemCard key={item.id} item={item} />
				))}
			</div>
		</div>
	)
}

export function GroupedLayout({ items }: LayoutProps) {
	const of = (source: SourceKey) => items.filter((item) => item.source === source)
	const present = (sources: SourceKey[]) => sources.filter((source) => of(source).length)
	const vertical = present(["short", "tiktok", "reel"])
	const posts = present(["bluesky", "threads", "mastodon", "reddit"])
	return (
		<section className="flex flex-col gap-8">
			<SectionHeading why={TITLE.why} count={items.length} />
			{of("youtube").length > 0 && <Group source="youtube" items={of("youtube")} cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" />}
			{vertical.length + (of("facebook").length ? 1 : 0) > 0 && (
				<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
					{vertical.map((source) => (
						// A lone vertical clip takes half a phone's width, not all of it at 9:16. Instagram needs 326 px once loaded.
						<Group key={source} source={source} items={of(source)} className={source === "short" ? "sm:col-span-2" : ""} cols={source === "short" ? "grid-cols-2" : source === "reel" ? "grid-cols-1 max-w-[22rem]" : "grid-cols-2 sm:grid-cols-1"} />
					))}
					{of("facebook").length > 0 && <Group source="facebook" items={of("facebook")} cols="grid-cols-2 sm:grid-cols-1" />}
				</div>
			)}
			{posts.length > 0 && (
				<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
					{posts.map((source) => (
						<Group key={source} source={source} items={of(source)} cols="grid-cols-1" />
					))}
				</div>
			)}
			{of("news").length > 0 && (
				<div className="flex flex-col gap-3">
					<div className="flex items-center gap-2 border-b border-white/10 pb-2">
						<SourceChip source="news" className="text-sm" />
						<span className="text-xs text-gray-500">{of("news").length}</span>
					</div>
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
						{of("news").map((item) => (
							<NewsCard key={item.id} item={item} />
						))}
					</div>
				</div>
			)}
		</section>
	)
}

// --- C: featured video plus a feed ---

function FeedRow({ item }: { item: SocialItem }) {
	const [loaded, load] = useLoaded(item.id)
	const isNews = item.source === "news"
	return (
		<li className="flex flex-col gap-2 border-b border-white/10 py-3 last:border-0" data-item={item.id} data-state={loaded ? "loaded" : "facade"}>
			<div className="flex items-center justify-between gap-2">
				<SourceChip source={item.source} />
				<span className="flex items-center gap-2">
					<SampleTag item={item} />
					<span className="text-xs text-gray-500">{ago(item.date)}</span>
				</span>
			</div>
			{loaded ? (
				<div className={shapeOf(item) === "vertical" && item.source !== "reel" ? "mx-auto w-full max-w-[16rem]" : ""}>
					<Player item={item} />
				</div>
			) : (
				<>
					{isNews ? (
						<a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[15px] font-semibold leading-snug text-gray-100 hover:underline">
							{item.text} <span className="text-amber-200/70">↗</span>
						</a>
					) : (
						<p className={`line-clamp-3 text-[15px] leading-snug ${item.textKind === "note" ? "italic text-gray-300" : "text-gray-100"}`}>{item.textKind === "post" ? `“${item.text}”` : item.text}</p>
					)}
					<div className="flex items-center justify-between gap-3">
						<span className="text-xs text-gray-400">
							{item.author}
							{item.handle && item.handle !== item.author ? ` ${item.handle}` : ""}
						</span>
						{!isNews && (
							<button type="button" data-load={item.id} onClick={load} title={consentLine(item.source)} className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gray-100 hover:bg-white/20">
								{actionLabel(item.source)} · loads {VENDORS[item.source].name}
							</button>
						)}
					</div>
				</>
			)}
		</li>
	)
}

export function FeaturedLayout({ items }: LayoutProps) {
	const videos = items.filter((item) => item.source === "youtube")
	const [featuredId, setFeaturedId] = useState<string | null>(null)
	const featured = videos.find((video) => video.id === featuredId) ?? videos[0]
	const feed = items.filter((item) => item !== featured && item.source !== "youtube")
	const [open, setOpen] = useState(false)
	const shown = open ? feed : feed.slice(0, 6)
	return (
		<section className="flex flex-col gap-4">
			<SectionHeading why={TITLE.why} count={items.length} />
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
				<div className="flex flex-col gap-3">
					{featured ? <ItemCard key={featured.id} item={featured} /> : <p className="text-gray-400">No video</p>}
					{videos.length > 1 && (
						<div className="flex gap-2 overflow-x-auto pb-1">
							{videos.map((video) => (
								<button
									type="button"
									key={video.id}
									onClick={() => setFeaturedId(video.id)}
									className={`flex w-44 shrink-0 flex-col gap-1 rounded-xl p-2 text-left text-xs ring-1 transition ${video === featured ? "bg-white/15 ring-white/40" : "bg-white/5 ring-white/10 hover:bg-white/10"}`}
								>
									<span className="line-clamp-2 font-semibold text-gray-100">{video.text}</span>
									<span className="text-gray-400">{video.author}</span>
								</button>
							))}
						</div>
					)}
				</div>
				<div className="rounded-2xl bg-white/[.04] px-4 ring-1 ring-white/10">
					<ul>
						{shown.map((item) => (
							<FeedRow key={item.id} item={item} />
						))}
					</ul>
					{feed.length > 6 && (
						<button type="button" onClick={() => setOpen(!open)} className="mb-3 w-full rounded-xl bg-white/5 py-2 text-sm font-semibold text-gray-200 hover:bg-white/10">
							{open ? "Fewer" : `${feed.length - 6} more`}
						</button>
					)}
				</div>
			</div>
		</section>
	)
}

// --- D: every source side by side, with costs ---

type Cost = {
	before: { thirdPartyRequests: number }
	after: {
		requests: number
		hosts: number
		hostList: string[]
		kb: number
		jsKb: number
		cookies: number
		setCookies: number
		vendorMs: number
		tbtMs: number
		scriptMs: number
		readyMs: number | null
	}
	runs: number
}
const COSTS = costs as unknown as { measuredAt?: string; note?: string; sources: Partial<Record<SourceKey, Cost>> }

/** One representative item per source. */
export const LAB_ITEMS: Record<SourceKey, string> = {
	youtube: "yt-trailer",
	short: "short-out-now",
	tiktok: "tiktok-1",
	reel: "reel-1",
	threads: "threads-1",
	facebook: "facebook-1",
	bluesky: "bsky-deadline",
	reddit: "reddit-1",
	mastodon: "masto-codorco",
	news: "news-deadline",
}

function CostLine({ source }: { source: SourceKey }) {
	const cost = COSTS.sources[source]
	if (source === "news") return <p className="text-xs text-gray-400">No third-party request before or after: the click opens the publisher's page.</p>
	if (!cost) return <p className="text-xs text-gray-500">Not measured yet.</p>
	const a = cost.after
	return (
		<dl className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
			<div>
				<dt className="text-gray-500">Before</dt>
				<dd className="font-semibold text-emerald-300">{cost.before.thirdPartyRequests} req.</dd>
			</div>
			<div>
				<dt className="text-gray-500">After</dt>
				<dd className="font-semibold">{a.requests} req.</dd>
			</div>
			<div>
				<dt className="text-gray-500">Hosts</dt>
				<dd className="font-semibold">{a.hosts}</dd>
			</div>
			<div>
				<dt className="text-gray-500">Transfer</dt>
				<dd className="font-semibold">{a.kb} KB</dd>
			</div>
			<div>
				<dt className="text-gray-500">Script</dt>
				<dd className="font-semibold">{a.jsKb} KB</dd>
			</div>
			<div>
				<dt className="text-gray-500">Vendor script</dt>
				<dd className="font-semibold">{a.vendorMs.toLocaleString("en")} ms</dd>
			</div>
			<div>
				<dt className="text-gray-500">Set-Cookie</dt>
				<dd className="font-semibold">{a.setCookies}</dd>
			</div>
			<div className="col-span-2">
				<dt className="text-gray-500">Player shown</dt>
				<dd className="font-semibold">{a.readyMs === null ? "never" : `${(a.readyMs / 1000).toFixed(1)} s`}</dd>
			</div>
		</dl>
	)
}

export function LabLayout({ items }: LayoutProps) {
	const { load } = useContext(SectionContext)
	const sources = SOURCE_ORDER.filter((source) => items.some((item) => item.source === source))
	const lab = sources.flatMap((source) => items.find((item) => item.id === LAB_ITEMS[source]) ?? items.filter((item) => item.source === source).slice(0, 1))
	const skipped = ITEMS.filter((item) => item.skip)
	return (
		<section className="flex flex-col gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 className="text-2xl font-bold">Every source side by side</h2>
					<p className="mt-1 text-sm text-gray-400">One item per source: the facade, and the official player after the click. Costs are measured per source on a page with only that item.</p>
				</div>
				<button type="button" onClick={() => lab.forEach((item) => load(item.id))} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-black hover:bg-gray-200">
					Load all {lab.filter((item) => item.source !== "news").length} players
				</button>
			</div>
			<div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{lab.map((item) => (
					<div key={item.id} className="flex flex-col gap-3 rounded-2xl bg-white/[.03] p-3 ring-1 ring-white/10" data-lab={item.source}>
						<div className="flex items-baseline justify-between gap-2">
							<span className="font-bold">{VENDORS[item.source].name}</span>
							<span className="text-[11px] text-gray-500">{VENDORS[item.source].kind === "iframe" ? "iframe" : VENDORS[item.source].kind === "script" ? "script + iframe" : "link"}</span>
						</div>
						<div className={shapeOf(item) === "vertical" && item.source !== "reel" ? "mx-auto w-full max-w-[15rem]" : ""}>
							<ItemCard item={item} />
						</div>
						<CostLine source={item.source} />
					</div>
				))}
			</div>
			{skipped.length > 0 && (
				<div className="rounded-2xl border border-dashed border-white/20 p-4 text-sm text-gray-300">
					<p className="font-semibold">Left out on purpose</p>
					<ul className="mt-2 list-disc pl-5 text-gray-400">
						{skipped.map((item) => (
							<li key={item.id}>
								{VENDORS[item.source].name}, {item.handle}: {item.skip}
							</li>
						))}
					</ul>
				</div>
			)}
			{COSTS.measuredAt && (
				<p className="text-xs text-gray-500">
					Measured {COSTS.measuredAt}. {COSTS.note}
				</p>
			)}
		</section>
	)
}

