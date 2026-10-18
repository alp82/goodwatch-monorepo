// PROTOTYPE - throwaway. The deeper "Hot on socials" page, round 3: one combined feed of what is said about the
// whole ranking, with search and filters. Owner's round 2 notes: C's combined feed is the direction; nav must say
// what it is and work on a phone; less border clutter; the outbound link cards were ugly; phones get less detail.
//   /prototype/hot-on-socials?variant=A|B|C   (#movie-123 or #show-456 opens filtered to that title)
// A: Stream. One calm column. Desktop: a filter panel at the left. Phone: search on top, a Filters sheet.
// B: Digest. Grouped by day, two columns; titles as a labeled poster row above.
// C: Clusters. One block per title with its best posts; "All N posts" narrows the feed to that title.
// Shared: search (title, headline, post, publisher), source, movie/show, title, sort. Cards are this file's own;
// a video or a post loads its platform's player only on press (the shared facade's rule).
import { type LinksFunction, json } from "@remix-run/node"
import { Link, useLoaderData, useSearchParams } from "@remix-run/react"
import { useEffect, useMemo, useState } from "react"
import { type TalkedItem, type TalkedRow, type TalkedTitle, liftLabel, reasonLabel } from "~/domain/talked-about-now"
import livingRoomCss from "~/ui/living-room/living-room.css?url"
import MediaText from "~/ui/media-text/MediaText"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { SocialEmbed } from "~/ui/social-embed/SocialEmbed"
import { SourceMark, embedOf } from "~/ui/talked-about-now/start-row/Items"
import { Spark, dateLabel } from "~/ui/talked-about-now/start-row/Spark"
import { hrefOf, tmdb } from "~/ui/talked-about-now/start-row/StartRow"
import { mediaFieldLanguage } from "~/utils/media-presentation"

export async function loader() {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	const { getHotOnSocialsDeep } = await import("~/server/talked-about-now/start-row.server")
	return json({ row: await getHotOnSocialsDeep() })
}
export const links: LinksFunction = () => [{ rel: "stylesheet", href: livingRoomCss }]
export const shouldRevalidate = () => false
export const meta = () => [{ title: "Hot on socials (prototype) · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

const VARIANTS = { A: "Stream", B: "Digest", C: "Clusters" }
const keyOf = (t: TalkedTitle) => `${t.mediaType}-${t.tmdbId}`
const Name = ({ title }: { title: TalkedTitle }) => (
	<MediaText value={{ text: title.title, lang: mediaFieldLanguage(title, "title") }} />
)
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`

// ---------------------------------------------------------------------------------------------------------
// Filters

type Source = "all" | "news" | "video" | "social"
type Kind = "all" | "movie" | "show"
type Sort = "new" | "hot"
type Filters = { q: string; source: Source; kind: Kind; title: string | null; sort: Sort }
type Post = { item: TalkedItem; title: TalkedTitle }

const SOURCES: [Source, string][] = [
	["all", "All"],
	["news", "News"],
	["video", "Videos"],
	["social", "Posts"],
]
const KINDS: [Kind, string][] = [
	["all", "All"],
	["movie", "Movies"],
	["show", "Shows"],
]
const sourceOf = (item: TalkedItem): Source =>
	item.source === "rss" ? "news" : item.source === "youtube" ? "video" : "social"

function useFilters() {
	const [f, setF] = useState<Filters>({ q: "", source: "all", kind: "all", title: null, sort: "new" })
	useEffect(() => {
		const hash = window.location.hash.slice(1)
		if (hash) setF((old) => ({ ...old, title: hash }))
	}, [])
	const set = (patch: Partial<Filters>) => setF((old) => ({ ...old, ...patch }))
	return [f, set] as const
}

function filterPosts(titles: TalkedTitle[], f: Filters, ignoreTitle = false): Post[] {
	const q = f.q.trim().toLowerCase()
	return titles
		.filter((t) => f.kind === "all" || t.mediaType === f.kind)
		.filter((t) => ignoreTitle || !f.title || keyOf(t) === f.title)
		.flatMap((t) => t.items.map((item) => ({ item, title: t })))
		.filter(({ item }) => f.source === "all" || sourceOf(item) === f.source)
		.filter(
			({ item, title }) =>
				!q || `${title.title} ${item.text} ${item.publisher} ${item.author}`.toLowerCase().includes(q),
		)
		.sort((a, b) =>
			f.sort === "hot" ? a.title.rank - b.title.rank || b.item.at.localeCompare(a.item.at) : b.item.at.localeCompare(a.item.at),
		)
}

const ago = (iso: string) => {
	const h = Math.max(0, (Date.now() - Date.parse(iso)) / 3_600_000)
	if (h < 1) return "just now"
	if (h < 24) return `${Math.floor(h)}h ago`
	const d = Math.floor(h / 24)
	return d === 1 ? "yesterday" : `${d} days ago`
}

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
	return (
		<div className="hx-seg" role="group" aria-label={label}>
			{options.map(([v, text]) => (
				<button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>
					{text}
				</button>
			))}
		</div>
	)
}

function Search({ f, set }: { f: Filters; set: (p: Partial<Filters>) => void }) {
	return (
		<label className="hx-search">
			<svg viewBox="0 0 20 20" aria-hidden="true">
				<circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
				<path d="M14 14l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
			</svg>
			<input
				type="search"
				value={f.q}
				onChange={(e) => set({ q: e.target.value })}
				placeholder="Search titles, headlines, posts"
				aria-label="Search what is said"
			/>
		</label>
	)
}

/** The filters that are on, as chips that take themselves off. */
function Active({ f, set, titles, count }: { f: Filters; set: (p: Partial<Filters>) => void; titles: TalkedTitle[]; count: number }) {
	const title = titles.find((t) => keyOf(t) === f.title)
	const chips: [string, () => void][] = []
	if (title) chips.push([title.title, () => set({ title: null })])
	if (f.source !== "all") chips.push([SOURCES.find(([v]) => v === f.source)?.[1] ?? "", () => set({ source: "all" })])
	if (f.kind !== "all") chips.push([KINDS.find(([v]) => v === f.kind)?.[1] ?? "", () => set({ kind: "all" })])
	if (f.q.trim()) chips.push([`“${f.q.trim()}”`, () => set({ q: "" })])
	return (
		<div className="hx-active">
			<b>{plural(count, "post")}</b>
			{chips.map(([text, off]) => (
				<button key={text} type="button" onClick={off}>
					{text} <span aria-hidden>×</span>
				</button>
			))}
			{chips.length > 1 && (
				<button type="button" className="hx-clear" onClick={() => set({ q: "", source: "all", kind: "all", title: null })}>
					Clear all
				</button>
			)}
		</div>
	)
}

/** The ranking as a list of names: what each title is, how hot, how much is said. Picks the title filter. */
function TitleList({ titles, f, set, day }: { titles: TalkedTitle[]; f: Filters; set: (p: Partial<Filters>) => void; day: string }) {
	return (
		<ol className="hx-titles">
			{titles.map((t) => (
				<li key={keyOf(t)}>
					<button
						type="button"
						aria-pressed={f.title === keyOf(t)}
						onClick={() => set({ title: f.title === keyOf(t) ? null : keyOf(t) })}
					>
						<span className="hx-t-n">{t.rank}</span>
						{t.poster ? <img src={tmdb(t.poster, "w92")} alt="" /> : <span className="hx-noposter" />}
						<span className="hx-t-text">
							<b>
								<Name title={t} />
							</b>
							<small>
								{t.reason ? reasonLabel(t.reason, t.mediaType) : t.mediaType === "movie" ? "Movie" : "TV show"} ·{" "}
								{plural(t.items.length, "post")}
							</small>
						</span>
						<span className="hx-t-lift">{liftLabel(t.lift)}</span>
					</button>
				</li>
			))}
		</ol>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The cards

function TitleTag({ title, onPick }: { title: TalkedTitle; onPick?: () => void }) {
	return (
		<button type="button" className="hx-tag" onClick={onPick} disabled={!onPick}>
			{title.poster && <img src={tmdb(title.poster, "w92")} alt="" />}
			<b>
				<Name title={title} />
			</b>
			<span>{liftLabel(title.lift)}</span>
		</button>
	)
}

const PLATFORM = { rss: "", youtube: "YouTube", bluesky: "Bluesky", mastodon: "Mastodon" } as const

function PostCard({ post, onPick, showTitle = true }: { post: Post; onPick?: () => void; showTitle?: boolean }) {
	const { item, title } = post
	const [open, setOpen] = useState(false)
	const by = item.source === "rss" ? item.publisher : item.author
	const meta = (
		<p className="hx-meta">
			<SourceMark source={item.source} />
			<b>{by}</b>
			{item.source !== "rss" && <span>on {PLATFORM[item.source]}</span>}
			<span>· {ago(item.at)}</span>
		</p>
	)
	if (open && item.source !== "rss")
		return (
			<article className="hx-card hx-card-open">
				{showTitle && <TitleTag title={title} onPick={onPick} />}
				<SocialEmbed item={embedOf(item)} loaded art={title.backdrop} />
			</article>
		)
	if (item.source === "youtube")
		return (
			<article className="hx-card hx-video">
				<button type="button" className="hx-thumb" onClick={() => setOpen(true)} aria-label={`Play ${item.text}`}>
					{title.backdrop && <img src={tmdb(title.backdrop, "w780")} alt="" loading="lazy" />}
					<span className="hx-play" aria-hidden />
					<small>Plays from YouTube</small>
				</button>
				<div className="hx-body">
					{showTitle && <TitleTag title={title} onPick={onPick} />}
					<h3>{item.text}</h3>
					{meta}
				</div>
			</article>
		)
	if (item.source === "rss")
		return (
			<article className="hx-card hx-news">
				<div className="hx-body">
					{showTitle && <TitleTag title={title} onPick={onPick} />}
					<a href={item.url} target="_blank" rel="noopener noreferrer" className="hx-headline">
						<h3>{item.text}</h3>
					</a>
					{meta}
				</div>
			</article>
		)
	return (
		<article className="hx-card hx-social">
			<div className="hx-body">
				{showTitle && <TitleTag title={title} onPick={onPick} />}
				<blockquote>{item.text}</blockquote>
				<div className="hx-social-foot">
					{meta}
					<button type="button" className="hx-show" onClick={() => setOpen(true)}>
						Show on {PLATFORM[item.source]}
					</button>
				</div>
			</div>
		</article>
	)
}

function Empty({ set }: { set: (p: Partial<Filters>) => void }) {
	return (
		<div className="hx-empty">
			<p>Nothing said matches.</p>
			<button type="button" onClick={() => set({ q: "", source: "all", kind: "all", title: null })}>
				Clear filters
			</button>
		</div>
	)
}

function Head({ row }: { row: TalkedRow }) {
	return (
		<header className="hx-head">
			<p className="lrb-eye">Talked about now · {dateLabel(row.day)}</p>
			<h1>Hot on socials</h1>
			<p>The titles people suddenly read about most, and what is being said about them.</p>
		</header>
	)
}

/** On a phone: one bar on top with the search and a Filters button; the filters open as a sheet from the bottom. */
function PhoneBar({ f, set, titles, day, count }: { f: Filters; set: (p: Partial<Filters>) => void; titles: TalkedTitle[]; day: string; count: number }) {
	const [open, setOpen] = useState(false)
	const on = [f.title, f.source !== "all", f.kind !== "all"].filter(Boolean).length
	return (
		<>
			<div className="hx-phonebar">
				<Search f={f} set={set} />
				<button type="button" className="hx-filters-btn" onClick={() => setOpen(true)}>
					Filters{on ? <b>{on}</b> : null}
				</button>
			</div>
			{open && (
				<div className="hx-sheet" role="dialog" aria-label="Filters">
					<button type="button" className="hx-sheet-bg" aria-label="Close" onClick={() => setOpen(false)} />
					<div className="hx-sheet-in">
						<div className="hx-sheet-head">
							<b>Filters</b>
							<button type="button" onClick={() => setOpen(false)}>
								Show {plural(count, "post")}
							</button>
						</div>
						<p className="hx-label">Source</p>
						<Seg value={f.source} options={SOURCES} onChange={(source) => set({ source })} label="Source" />
						<p className="hx-label">Type</p>
						<Seg value={f.kind} options={KINDS} onChange={(kind) => set({ kind })} label="Type" />
						<p className="hx-label">Sort</p>
						<Seg value={f.sort} options={[["new", "Newest"], ["hot", "Hottest title"]]} onChange={(sort) => set({ sort })} label="Sort" />
						<p className="hx-label">Title</p>
						<TitleList titles={titles} f={f} set={(p) => (set(p), setOpen(false))} day={day} />
					</div>
				</div>
			)}
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// A: Stream

function Stream({ row, said }: { row: TalkedRow; said: TalkedTitle[] }) {
	const [f, set] = useFilters()
	const posts = filterPosts(said, f)
	return (
		<div className="hx-a">
			<aside className="hx-panel">
				<Search f={f} set={set} />
				<p className="hx-label">Source</p>
				<Seg value={f.source} options={SOURCES} onChange={(source) => set({ source })} label="Source" />
				<p className="hx-label">Type</p>
				<Seg value={f.kind} options={KINDS} onChange={(kind) => set({ kind })} label="Type" />
				<p className="hx-label">Titles</p>
				<TitleList titles={said} f={f} set={set} day={row.day} />
			</aside>
			<div className="hx-main">
				<PhoneBar f={f} set={set} titles={said} day={row.day} count={posts.length} />
				<div className="hx-mainbar">
					<Active f={f} set={set} titles={said} count={posts.length} />
					<Seg value={f.sort} options={[["new", "Newest"], ["hot", "Hottest"]]} onChange={(sort) => set({ sort })} label="Sort" />
				</div>
				{posts.length ? (
					<div className="hx-stream">
						{posts.map((p) => (
							<PostCard key={`${keyOf(p.title)}-${p.item.id}`} post={p} onPick={() => set({ title: keyOf(p.title) })} showTitle={!f.title} />
						))}
					</div>
				) : (
					<Empty set={set} />
				)}
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// B: Digest

const dayGroup = (iso: string) => {
	const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)
	return d <= 0 ? "Today" : d === 1 ? "Yesterday" : d < 7 ? "Earlier this week" : "Older"
}

function Digest({ row, said }: { row: TalkedRow; said: TalkedTitle[] }) {
	const [f, set] = useFilters()
	const posts = filterPosts(said, { ...f, sort: "new" })
	const groups = posts.reduce<[string, Post[]][]>((out, p) => {
		const g = dayGroup(p.item.at)
		const last = out.at(-1)
		if (last && last[0] === g) last[1].push(p)
		else out.push([g, [p]])
		return out
	}, [])
	return (
		<div className="hx-b">
			<div className="hx-shelf" role="group" aria-label="Titles">
				{said.map((t) => (
					<button
						key={keyOf(t)}
						type="button"
						aria-pressed={f.title === keyOf(t)}
						onClick={() => set({ title: f.title === keyOf(t) ? null : keyOf(t) })}
					>
						<span className="hx-shelf-poster">
							{t.poster && <img src={tmdb(t.poster, "w185")} alt="" />}
							<em>{liftLabel(t.lift)}</em>
						</span>
						<b>
							<Name title={t} />
						</b>
						<small>{plural(t.items.length, "post")}</small>
					</button>
				))}
			</div>
			<div className="hx-b-bar">
				<div className="hx-b-wide">
					<Search f={f} set={set} />
					<Seg value={f.source} options={SOURCES} onChange={(source) => set({ source })} label="Source" />
					<Seg value={f.kind} options={KINDS} onChange={(kind) => set({ kind })} label="Type" />
				</div>
				<PhoneBar f={f} set={set} titles={said} day={row.day} count={posts.length} />
			</div>
			<Active f={f} set={set} titles={said} count={posts.length} />
			{groups.length ? (
				groups.map(([g, list]) => (
					<section key={g} className="hx-day">
						<h2>{g}</h2>
						<div className="hx-grid">
							{list.map((p) => (
								<PostCard key={`${keyOf(p.title)}-${p.item.id}`} post={p} onPick={() => set({ title: keyOf(p.title) })} showTitle={!f.title} />
							))}
						</div>
					</section>
				))
			) : (
				<Empty set={set} />
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// C: Clusters

function Clusters({ row, said }: { row: TalkedRow; said: TalkedTitle[] }) {
	const [f, set] = useFilters()
	const posts = filterPosts(said, f, true)
	const byTitle = said
		.map((t) => ({ title: t, posts: posts.filter((p) => p.title === t) }))
		.filter((c) => c.posts.length)
	const focus = said.find((t) => keyOf(t) === f.title)
	return (
		<div className="hx-c">
			<div className="hx-c-bar">
				<div className="hx-b-wide">
					<Search f={f} set={set} />
					<Seg value={f.source} options={SOURCES} onChange={(source) => set({ source })} label="Source" />
					<Seg value={f.kind} options={KINDS} onChange={(kind) => set({ kind })} label="Type" />
				</div>
				<PhoneBar f={f} set={set} titles={said} day={row.day} count={posts.length} />
			</div>
			{focus ? (
				<>
					<button type="button" className="hx-back" onClick={() => set({ title: null })}>
						← All titles
					</button>
					<ClusterHead title={focus} day={row.day} count={posts.filter((p) => p.title === focus).length} />
					<div className="hx-grid">
						{posts
							.filter((p) => p.title === focus)
							.map((p) => (
								<PostCard key={p.item.id} post={p} showTitle={false} />
							))}
					</div>
				</>
			) : byTitle.length ? (
				<div className="hx-clusters">
					{byTitle.map(({ title, posts: list }) => (
						<section key={keyOf(title)} className="hx-cluster">
							<ClusterHead title={title} day={row.day} count={list.length} />
							<div className="hx-cluster-posts">
								{list.slice(0, 2).map((p) => (
									<PostCard key={p.item.id} post={p} showTitle={false} />
								))}
							</div>
							{list.length > 1 && (
								<button type="button" className="hx-more" onClick={() => (set({ title: keyOf(title) }), window.scrollTo({ top: 0 }))}>
									All {list.length} posts about <Name title={title} /> →
								</button>
							)}
						</section>
					))}
				</div>
			) : (
				<Empty set={set} />
			)}
		</div>
	)
}

function ClusterHead({ title, day, count }: { title: TalkedTitle; day: string; count: number }) {
	return (
		<header className="hx-chead">
			<span className="hx-t-n">{title.rank}</span>
			{title.poster && <img src={tmdb(title.poster, "w154")} alt="" />}
			<div>
				<Link to={hrefOf(title)} discover="none">
					<h2>
						<Name title={title} />
					</h2>
				</Link>
				<p>
					{title.reason ? `${reasonLabel(title.reason, title.mediaType)} · ` : ""}
					{plural(count, "post")}
				</p>
			</div>
			<div className="hx-chead-buzz">
				<b>{liftLabel(title.lift)}</b>
				<Spark title={title} day={day} width={110} height={32} mark={false} />
			</div>
		</header>
	)
}

// ---------------------------------------------------------------------------------------------------------

export default function HotOnSocialsPrototype() {
	const { row } = useLoaderData<typeof loader>() as { row: TalkedRow | null }
	const [params] = useSearchParams()
	const variant = params.get("variant") ?? "A"
	const said = useMemo(() => row?.titles.filter((t) => t.items.length > 0) ?? [], [row])
	if (!row?.titles.length)
		return (
			<div className="lrb hx">
				<p className="lrb-in">No ranking today.</p>
			</div>
		)
	return (
		<div className="lrb hx">
			<div className="lrb-in hx-in">
				<Head row={row} />
				{variant === "B" ? <Digest row={row} said={said} /> : variant === "C" ? <Clusters row={row} said={said} /> : <Stream row={row} said={said} />}
			</div>
			<PrototypeSwitcher variants={VARIANTS} />
		</div>
	)
}
