// PROTOTYPE - throwaway. ?variant=matches: the featured layout filled with real matched posts from the matching
// prototype (branch prototype/talked-about-now-matching, matches.json: 50 titles, 668 links, 12 to 14 Oct 2026), so
// the owner sees what matching would put on a title page before deciding how posts get attached to titles.
// Every item carries a debug badge: lane, confidence, hand label. Bluesky posts whose author set !no-unauthenticated,
// and deleted posts, are left out and counted. Posters and backdrops were read once from production Crate.
import { useSearchParams } from "@remix-run/react"
import { useCallback, useContext, useEffect, useMemo, useState } from "react"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { ItemCard, Player, SectionContext, SourceChip, actionLabel, consentLine, useLoaded } from "./embeds"
import { type SocialItem, VENDORS, ago } from "./social"

type Label = "right" | "wrong" | "unsure" | null
type Post = {
	id: string
	source: "bluesky" | "rss" | "youtube"
	url: string
	author: string
	publisher: string
	timestamp: string
	text: string
	headline: string | null
	lane: string
	confidence: number
	label: Label
	labelNote: string | null
	reason: string
	discovery: string[]
	videoId?: string
	bsky?: { uri: string; cid: string; name: string; handle: string; optout: boolean }
	deleted?: boolean
}
type Title = {
	key: string
	tmdbId: number
	type: "movie" | "tv"
	title: string
	year: number
	postCount: number
	sourceCounts: Record<string, number>
	buzzRanks: Record<string, number>
	diagnostic: boolean
	poster: string | null
	backdrop: string | null
	posts: Post[]
}
type Data = { generatedAt: string; branch: string; window: { start: string; end: string }; titles: Title[] }

const LANES: Record<string, string> = {
	official_video_id: "official video ID",
	foreground_exact: "foreground exact",
	alt_title_context: "alternate title",
	foreground_fuzzy: "fuzzy",
	vector_context: "vector",
}

// Which links could go up without a person looking. Round two's report: only the official video-ID lane is clean; Bluesky
// foreground exact (28 of 29 right in the holdout) is the pilot candidate it names next. Everything else needs review.
const MODES = {
	auto: { label: "Automatic only", hint: "official video ID", keep: (p: Post) => p.lane === "official_video_id" },
	pilot: { label: "+ Bluesky exact", hint: "the pilot candidate", keep: (p: Post) => p.lane === "official_video_id" || (p.source === "bluesky" && p.lane === "foreground_exact") },
	all: { label: "Everything matched", hint: "all lanes", keep: () => true },
} as const
type Mode = keyof typeof MODES

const hidden = (p: Post) => p.deleted || p.bsky?.optout

function counts(posts: Post[]) {
	const c = { right: 0, wrong: 0, unsure: 0, none: 0 }
	for (const p of posts) c[p.label ?? "none"]++
	return c
}

/** A matched post as an item the shared facades understand. */
function toItem(post: Post, title: Title): SocialItem {
	if (post.source === "youtube" && post.videoId)
		return {
			id: post.id,
			source: "youtube",
			author: post.publisher,
			date: post.timestamp,
			text: post.headline ?? post.text,
			textKind: "title",
			url: post.url,
			embed: { type: "youtube", videoId: post.videoId },
			art: title.backdrop ? { kind: "backdrop", path: title.backdrop } : undefined,
		}
	if (post.source === "bluesky" && post.bsky) {
		const [, did, , rkey] = post.bsky.uri.replace("at://", "").match(/^(did:[^/]+)\/([^/]+)\/(.+)$/) ?? []
		return {
			id: post.id,
			source: "bluesky",
			author: post.bsky.name,
			handle: `@${post.bsky.handle}`,
			date: post.timestamp,
			text: post.text,
			textKind: "post",
			url: post.url,
			embed: { type: "bluesky", uri: post.bsky.uri, cid: post.bsky.cid, text: post.text, authorDid: did ?? "", postRkey: rkey ?? "", authorLabel: `${post.bsky.name} (@${post.bsky.handle})`, createdAt: post.timestamp },
		}
	}
	return {
		id: post.id,
		source: "news",
		author: post.publisher.replace(/^www\./, ""),
		date: post.timestamp,
		text: post.headline ?? post.text,
		textKind: "title",
		url: post.url,
		embed: { type: "link" },
	}
}

// --- Debug badge ---

const LABEL_STYLE: Record<string, string> = {
	right: "bg-emerald-500/20 text-emerald-200 ring-emerald-400/50",
	wrong: "bg-red-500/25 text-red-200 ring-red-400/60",
	unsure: "bg-gray-500/30 text-gray-200 ring-gray-400/50",
}

function Badge({ post }: { post: Post }) {
	return (
		<div className="flex flex-wrap items-center gap-1 font-mono text-[10px] leading-tight" data-badge>
			<span className="rounded bg-fuchsia-500/15 px-1.5 py-0.5 text-fuchsia-200 ring-1 ring-fuchsia-400/30" title={post.reason}>
				{LANES[post.lane] ?? post.lane}
			</span>
			<span className="rounded bg-white/5 px-1.5 py-0.5 text-gray-300 ring-1 ring-white/10">{post.confidence.toFixed(2)}</span>
			{post.label && (
				<span className={`rounded px-1.5 py-0.5 font-bold uppercase ring-1 ${LABEL_STYLE[post.label]}`} title={post.labelNote ?? undefined}>
					{post.label}
				</span>
			)}
			<details className="w-full text-gray-400 [&[open]]:pb-1">
				<summary className="cursor-pointer select-none text-gray-500 hover:text-gray-300">why</summary>
				<p className="mt-1 font-sans text-[11px] text-gray-300">{post.reason}</p>
				{post.labelNote && <p className="mt-1 font-sans text-[11px] text-gray-400">Hand label: {post.labelNote}</p>}
				<p className="mt-1 text-gray-500">{post.discovery.join(", ")}</p>
			</details>
		</div>
	)
}

function LabelCounts({ posts, className = "" }: { posts: Post[]; className?: string }) {
	const c = counts(posts)
	return (
		<span className={`inline-flex items-center gap-2 font-mono text-[11px] ${className}`}>
			<span className="text-emerald-300">✓{c.right}</span>
			<span className="text-red-300">✗{c.wrong}</span>
			{c.unsure > 0 && <span className="text-gray-400">?{c.unsure}</span>}
		</span>
	)
}

// --- Feed row: the featured layout's row, with the badge ---

function FeedRow({ post, item }: { post: Post; item: SocialItem }) {
	const [loaded, load] = useLoaded(item.id)
	const isNews = item.source === "news"
	return (
		<li className={`flex flex-col gap-2 border-b border-white/10 py-3 last:border-0 ${post.label === "wrong" ? "bg-red-500/[.04]" : ""}`} data-item={item.id} data-state={loaded ? "loaded" : "facade"}>
			<div className="flex items-center justify-between gap-2">
				<SourceChip source={item.source} />
				<span className="text-xs text-gray-500">{ago(item.date)}</span>
			</div>
			{loaded ? (
				<Player item={item} />
			) : (
				<>
					{isNews ? (
						<a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[15px] font-semibold leading-snug text-gray-100 hover:underline">
							{item.text} <span className="text-amber-200/70">↗</span>
						</a>
					) : (
						<p className="line-clamp-4 text-[15px] leading-snug text-gray-100">{item.textKind === "post" ? `“${item.text}”` : item.text}</p>
					)}
					<div className="flex items-center justify-between gap-3">
						<span className="min-w-0 truncate text-xs text-gray-400">
							{isNews ? `${item.author}${post.author && post.author !== post.publisher ? ` · ${post.author}` : ""}` : `${item.author} ${item.handle ?? ""}`}
						</span>
						{!isNews && (
							<button type="button" data-load={item.id} onClick={load} title={consentLine(item.source)} className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gray-100 hover:bg-white/20">
								{actionLabel(item.source)} · loads {VENDORS[item.source].name}
							</button>
						)}
					</div>
				</>
			)}
			<Badge post={post} />
		</li>
	)
}

/** The featured slot without a video: the newest headline, over the title's backdrop. */
function LeadStory({ post, item, title }: { post: Post; item: SocialItem; title: Title }) {
	return (
		<div className="flex flex-col gap-2" data-item={item.id}>
			<a href={item.url} target="_blank" rel="noopener noreferrer" className="group relative block aspect-video overflow-hidden rounded-2xl bg-gray-800 ring-1 ring-white/10">
				{title.backdrop && <img src={tmdbImageUrl(title.backdrop, "w780")} alt="" className="absolute inset-0 h-full w-full object-cover" />}
				<span className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/10" />
				<span className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-5">
					<span className="text-xs font-semibold text-amber-200">
						{item.author} · {ago(item.date)}
					</span>
					<span className="text-xl font-bold leading-snug text-white group-hover:underline md:text-2xl">{item.text} ↗</span>
				</span>
			</a>
			<Badge post={post} />
		</div>
	)
}

function Featured({ title, posts }: { title: Title; posts: Post[] }) {
	const items = useMemo(() => new Map(posts.map((p) => [p.id, toItem(p, title)])), [posts, title])
	const videos = posts.filter((p) => p.source === "youtube")
	const [featuredId, setFeaturedId] = useState<string | null>(null)
	const lead = videos.find((v) => v.id === featuredId) ?? videos[0] ?? posts.find((p) => p.source === "rss")
	// Posts go in the feed beside the lead; the other headlines fill the column under it. Without posts, the headlines
	// are the feed.
	const social = posts.filter((p) => p.source === "bluesky")
	const news = posts.filter((p) => p !== lead && p.source === "rss")
	const feed = social.length ? social : news
	const headlines = social.length ? news : []
	const [open, setOpen] = useState(false)
	const [moreNews, setMoreNews] = useState(false)
	const SHOWN = 10
	const shown = open ? feed : feed.slice(0, SHOWN)
	const { load } = useContextLoad()
	if (!posts.length) return <EmptyState />
	return (
		<div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
			<div className="flex flex-col gap-3">
				{lead?.source === "youtube" ? (
					<div className="flex flex-col gap-2">
						<ItemCard key={lead.id} item={items.get(lead.id) as SocialItem} />
						<Badge post={lead} />
					</div>
				) : lead ? (
					<LeadStory post={lead} item={items.get(lead.id) as SocialItem} title={title} />
				) : (
					<p className="rounded-2xl bg-white/5 p-6 text-sm text-gray-400">No video or headline for this title: the feed carries it alone.</p>
				)}
				{videos.length > 1 && (
					<div className="flex gap-2 overflow-x-auto pb-1">
						{videos.map((video) => (
							<button
								type="button"
								key={video.id}
								onClick={() => setFeaturedId(video.id)}
								className={`flex w-48 shrink-0 flex-col gap-1 rounded-xl p-2 text-left text-xs ring-1 transition ${video === lead ? "bg-white/15 ring-white/40" : "bg-white/5 ring-white/10 hover:bg-white/10"}`}
							>
								<span className="line-clamp-2 font-semibold text-gray-100">{video.headline ?? video.text}</span>
								<span className="text-gray-400">{video.publisher}</span>
							</button>
						))}
					</div>
				)}
				{headlines.length > 0 && (
					<div className="rounded-2xl bg-white/[.04] px-4 ring-1 ring-white/10">
						<p className="pt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">More headlines</p>
						<ul>
							{(moreNews ? headlines : headlines.slice(0, 5)).map((post) => (
								<FeedRow key={post.id} post={post} item={items.get(post.id) as SocialItem} />
							))}
						</ul>
						{headlines.length > 5 && (
							<button type="button" onClick={() => setMoreNews(!moreNews)} className="mb-3 w-full rounded-xl bg-white/5 py-2 text-sm font-semibold text-gray-200 hover:bg-white/10">
								{moreNews ? "Fewer" : `${headlines.length - 5} more`}
							</button>
						)}
					</div>
				)}
			</div>
			<div className="self-start rounded-2xl bg-white/[.04] px-4 ring-1 ring-white/10">
				{feed.some((p) => p.source === "bluesky") && (
					<div className="flex justify-end pt-3">
						<button type="button" onClick={() => shown.filter((p) => p.source === "bluesky").forEach((p) => load(p.id))} className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-semibold text-gray-300 hover:bg-white/10" title={consentLine("bluesky")}>
							Load the shown Bluesky posts
						</button>
					</div>
				)}
				<ul>
					{shown.map((post) => (
						<FeedRow key={post.id} post={post} item={items.get(post.id) as SocialItem} />
					))}
				</ul>
				{feed.length > SHOWN && (
					<button type="button" onClick={() => setOpen(!open)} className="mb-3 w-full rounded-xl bg-white/5 py-2 text-sm font-semibold text-gray-200 hover:bg-white/10">
						{open ? "Fewer" : `${feed.length - SHOWN} more`}
					</button>
				)}
			</div>
		</div>
	)
}

function EmptyState() {
	return (
		<div className="rounded-2xl border border-dashed border-white/20 p-8 text-center text-sm text-gray-400">
			Nothing to show in this mode. Switch to “Everything matched” to see what the text lanes found.
		</div>
	)
}

const useContextLoad = () => useContext(SectionContext)

// --- Title header ---

function TitleHeader({ title, visible, mode }: { title: Title; visible: Post[]; mode: Mode }) {
	const left = title.posts.filter(hidden)
	const optout = title.posts.filter((p) => p.bsky?.optout).length
	const deleted = title.posts.filter((p) => p.deleted).length
	const buzz = Object.entries(title.buzzRanks)
	return (
		<div className="relative overflow-hidden rounded-3xl bg-gray-800/60 ring-1 ring-white/10">
			{title.backdrop && <img src={tmdbImageUrl(title.backdrop, "w1280")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />}
			<div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/80 to-gray-950/30" />
			<div className="relative flex gap-5 p-5 md:p-7">
				{title.poster && <img src={tmdbImageUrl(title.poster, "w185")} alt="" className="hidden w-28 shrink-0 rounded-xl shadow-2xl ring-1 ring-white/20 sm:block md:w-36" />}
				<div className="flex min-w-0 flex-col gap-2">
					<p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
						{title.type === "tv" ? "Show" : "Movie"} · {title.year} · TMDB {title.tmdbId}
					</p>
					<h1 className="text-3xl font-bold leading-tight md:text-4xl">{title.title}</h1>
					<div className="flex flex-wrap gap-1.5 text-xs">
						{buzz.length > 0 && (
							<span className="rounded-full bg-rose-500/20 px-2 py-0.5 font-semibold text-rose-200 ring-1 ring-rose-400/40">
								buzz {buzz.map(([k, v]) => `${k.replace("_", " ")} #${v}`).join(" · ")}
							</span>
						)}
						{title.diagnostic && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 font-semibold text-amber-200 ring-1 ring-amber-400/40">wrong-link check title</span>}
						{Object.entries(title.sourceCounts).map(([s, n]) => (
							<span key={s} className="rounded-full bg-white/10 px-2 py-0.5 text-gray-200">
								{s === "rss" ? "news" : s} {n}
							</span>
						))}
					</div>
					<p className="text-sm text-gray-300">
						Showing <b>{visible.length}</b> of {title.postCount} matched posts ({MODES[mode].label.toLowerCase()}) · hand labels <LabelCounts posts={visible} />
						{left.length > 0 && (
							<span className="text-gray-400">
								{" "}
								· left out: {optout > 0 && `${optout} Bluesky opt-out`}
								{optout > 0 && deleted > 0 && ", "}
								{deleted > 0 && `${deleted} deleted`}
							</span>
						)}
					</p>
				</div>
			</div>
		</div>
	)
}

// --- Title picker ---

function Picker({ titles, current, onPick }: { titles: Title[]; current: Title; onPick: (key: string) => void }) {
	return (
		<>
			<select
				value={current.key}
				onChange={(e) => onPick(e.target.value)}
				className="w-full rounded-xl border-0 bg-white/10 px-3 py-2 text-sm text-gray-100 ring-1 ring-white/15 lg:hidden"
				aria-label="Title"
			>
				{titles.map((t) => (
					<option key={t.key} value={t.key} className="bg-gray-900">
						{t.postCount} · {t.title} ({t.year}){Object.keys(t.buzzRanks).length ? " · buzz" : ""}
						{t.diagnostic ? " · check" : ""}
					</option>
				))}
			</select>
			<nav className="hidden max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl bg-white/[.03] p-1.5 ring-1 ring-white/10 lg:block" aria-label="Titles" data-picker>
				<p className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{titles.length} titles · by matched posts</p>
				{titles.map((t) => {
					const c = counts(t.posts)
					return (
						<button
							type="button"
							key={t.key}
							onClick={() => onPick(t.key)}
							className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${t === current ? "bg-white/15 text-white" : "text-gray-300 hover:bg-white/5"}`}
						>
							<span className="w-7 shrink-0 text-right font-mono text-xs text-gray-500">{t.postCount}</span>
							<span className="min-w-0 flex-1 truncate">{t.title}</span>
							{Object.keys(t.buzzRanks).length > 0 && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" title="buzz title" />}
							{t.diagnostic && <span className="shrink-0 text-[10px] text-amber-300" title="wrong-link check title">chk</span>}
							{(c.right > 0 || c.wrong > 0) && (
								<span className="shrink-0 font-mono text-[10px]">
									{c.right > 0 && <span className="text-emerald-300">✓{c.right}</span>}
									{c.wrong > 0 && <span className="ml-1 text-red-300">✗{c.wrong}</span>}
								</span>
							)}
						</button>
					)
				})}
			</nav>
		</>
	)
}

// --- The page ---

export function MatchesPage() {
	const [data, setData] = useState<Data | null>(null)
	useEffect(() => {
		import("./matches.json").then((m) => setData(m.default as unknown as Data))
	}, [])
	const [params, setParams] = useSearchParams()
	const set = (key: string, value: string) => {
		const p = new URLSearchParams(params)
		p.set(key, value)
		setParams(p, { replace: true, preventScrollReset: true })
	}
	const mode = ((params.get("lanes") ?? "all") in MODES ? (params.get("lanes") ?? "all") : "all") as Mode
	const titles = useMemo(() => (data ? [...data.titles].sort((a, b) => b.postCount - a.postCount) : []), [data])
	const current = titles.find((t) => t.key === params.get("title")) ?? titles[0]
	const visible = useMemo(
		() => (current ? current.posts.filter((p) => !hidden(p) && MODES[mode].keep(p)).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)) : []),
		[current, mode],
	)
	const [loaded, setLoaded] = useState<Set<string>>(new Set())
	const load = useCallback((id: string) => setLoaded((prev) => new Set(prev).add(id)), [])
	// A new title or mode starts behind the facades again.
	useEffect(() => setLoaded(new Set()), [current?.key, mode])

	if (!data || !current) return <div className="mt-24 p-8 text-center text-gray-400">Loading matches…</div>
	const totals = data.titles.flatMap((t) => t.posts)
	return (
		<SectionContext.Provider value={{ loaded, load }}>
			<div className="mx-auto mt-20 grid w-full max-w-[96rem] grid-cols-1 gap-6 px-4 pb-32 sm:px-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:px-8" data-matches>
				<aside className="flex flex-col gap-3 lg:sticky lg:top-20 lg:self-start">
					<Picker titles={titles} current={current} onPick={(key) => set("title", key)} />
				</aside>
				<main className="flex min-w-0 flex-col gap-6">
					<TitleHeader title={current} visible={visible} mode={mode} />
					<div id="talked-about-now" data-hydrated className="flex flex-col gap-4">
						<div className="flex flex-wrap items-end justify-between gap-3">
							<div>
								<h2 className="flex items-center gap-2 text-2xl font-bold">
									<span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-rose-500" />
									Talked about now
								</h2>
								<p className="mt-1 text-sm text-gray-400">
									Real matched posts, {new Date(data.window.start).toUTCString().slice(5, 11)} to {new Date(data.window.end).toUTCString().slice(5, 11)} · debug badges show lane, confidence and hand label
								</p>
							</div>
							<div className="flex rounded-full bg-white/5 p-1 ring-1 ring-white/10" aria-label="Lanes">
								{(Object.keys(MODES) as Mode[]).map((key) => {
									const n = current.posts.filter((p) => !hidden(p) && MODES[key].keep(p)).length
									return (
										<button
											type="button"
											key={key}
											aria-pressed={mode === key}
											onClick={() => set("lanes", key)}
											title={MODES[key].hint}
											className={`rounded-full px-3 py-1.5 text-xs font-semibold ${mode === key ? "bg-white text-black" : "text-gray-300 hover:bg-white/10"}`}
										>
											{MODES[key].label} <span className="opacity-60">{n}</span>
										</button>
									)
								})}
							</div>
						</div>
						<Featured key={`${current.key}-${mode}`} title={current} posts={visible} />
					</div>
					<p className="text-xs text-gray-500">
						All 50 titles: {totals.length} links, hand labels <LabelCounts posts={totals} /> ({totals.filter((p) => p.label === null).length} unlabeled). No link in this export came through the official video-ID lane. {totals.filter((p) => p.bsky?.optout).length} Bluesky posts are from authors with !no-unauthenticated and are never shown. Source:{" "}
						<code>{data.branch}</code>, generated {data.generatedAt.slice(0, 16).replace("T", " ")} UTC.
					</p>
				</main>
			</div>
		</SectionContext.Provider>
	)
}
