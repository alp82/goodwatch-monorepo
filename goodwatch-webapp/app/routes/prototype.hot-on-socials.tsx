// PROTOTYPE - throwaway. The deeper "Hot on socials" page, round 2: the whole ranking (not 8), up to 12 posts per
// title (not 3), and each title's GoodWatch score and tagline. Three story-feed designs:
//   /prototype/hot-on-socials?variant=A|B|C   (#movie-123 or #show-456 jumps to a title)
// A: Magazine. Poster column and a masonry of posts per title; the top three larger.
// B: Shelves. A slim backdrop band per title, its posts as a row to scroll sideways.
// C: Feed. Every post of every title in one stream, newest first, with the ranking beside it as a filter.
// Titles with nothing said yet sit together at the end ("Also rising"). Reads getHotOnSocialsDeep() directly.
import { type LinksFunction, json } from "@remix-run/node"
import { Link, useLoaderData, useSearchParams } from "@remix-run/react"
import { useMemo, useState } from "react"
import { type TalkedItem, type TalkedRow, type TalkedTitle, compact, liftLabel, reasonLabel } from "~/domain/talked-about-now"
import livingRoomCss from "~/ui/living-room/living-room.css?url"
import MediaText from "~/ui/media-text/MediaText"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { SocialEmbed } from "~/ui/social-embed/SocialEmbed"
import { Platform, SourceMark, embedOf } from "~/ui/talked-about-now/start-row/Items"
import { Spark, dateLabel } from "~/ui/talked-about-now/start-row/Spark"
import { Move, ReasonIcon, hrefOf, tmdb } from "~/ui/talked-about-now/start-row/StartRow"
import { mediaFieldLanguage } from "~/utils/media-presentation"

export async function loader() {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	const { getHotOnSocialsDeep } = await import("~/server/talked-about-now/start-row.server")
	return json({ row: await getHotOnSocialsDeep() })
}
export const links: LinksFunction = () => [{ rel: "stylesheet", href: livingRoomCss }]
export const shouldRevalidate = () => false
export const meta = () => [{ title: "Hot on socials (prototype) · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

const VARIANTS = { A: "Magazine", B: "Shelves", C: "Feed" }
const keyOf = (t: TalkedTitle) => `${t.mediaType}-${t.tmdbId}`
const Name = ({ title }: { title: TalkedTitle }) => (
	<MediaText value={{ text: title.title, lang: mediaFieldLanguage(title, "title") }} />
)
const kind = (t: TalkedTitle) => `${t.mediaType === "movie" ? "Movie" : "TV show"}${t.year ? ` · ${t.year}` : ""}`

function Score({ title }: { title: TalkedTitle }) {
	const score = title.extra?.score
	if (score == null) return null
	return (
		<span className="hs-score" title="GoodWatch score">
			<b>{Math.round(score)}</b>
		</span>
	)
}

function Reason({ title }: { title: TalkedTitle }) {
	if (!title.reason) return null
	return (
		<span className={`tn-chip tn-chip-${title.reason.kind}`}>
			<ReasonIcon kind={title.reason.kind} />
			{reasonLabel(title.reason, title.mediaType)}, {dateLabel(title.reason.day)}
		</span>
	)
}

function Post({ item, title, variant = "card" }: { item: TalkedItem; title: TalkedTitle; variant?: "card" | "row" }) {
	return (
		<SocialEmbed
			item={embedOf(item)}
			art={item.source === "youtube" ? title.backdrop : undefined}
			artSizes={[[null, "480px"]]}
			variant={variant}
			className="h-full"
		/>
	)
}

/** The page's head: what the ranking is, and the day's totals. */
function Head({ row, said }: { row: TalkedRow; said: TalkedTitle[] }) {
	const sources = [...new Set(row.titles.flatMap((t) => t.items.map((i) => i.source)))]
	const posts = row.titles.reduce((n, t) => n + t.items.length, 0)
	const top = row.titles[0]
	return (
		<header className="hs-head">
			<div>
				<p className="lrb-eye">Talked about now · {dateLabel(row.day)}</p>
				<h1 className="hs-h1">Hot on socials</h1>
				<p className="hs-lede">Who the internet is reading about, and what it is saying.</p>
			</div>
			<dl className="hs-stats">
				<div>
					<dt>Titles rising</dt>
					<dd>{row.titles.length}</dd>
				</div>
				<div>
					<dt>Posts</dt>
					<dd>{posts}</dd>
				</div>
				<div>
					<dt>Top spike</dt>
					<dd>{liftLabel(top.lift)}</dd>
				</div>
				<div>
					<dt>Sources</dt>
					<dd className="hs-stat-sources">
						{sources.map((source) => (
							<Platform key={source} source={source} />
						))}
					</dd>
				</div>
			</dl>
		</header>
	)
}

/** A sticky strip of every title with something said: poster, rank, ×N. */
function Strip({ titles }: { titles: TalkedTitle[] }) {
	return (
		<nav className="hs-strip" aria-label="Titles">
			{titles.map((t) => (
				<a key={keyOf(t)} href={`#${keyOf(t)}`}>
					{t.poster && <img src={tmdb(t.poster, "w92")} alt="" />}
					<b>{t.rank}</b>
					<small>{liftLabel(t.lift)}</small>
				</a>
			))}
		</nav>
	)
}

/** The titles with nothing said yet: a compact grid at the end. */
function AlsoRising({ titles, day }: { titles: TalkedTitle[]; day: string }) {
	if (!titles.length) return null
	return (
		<section className="hs-also">
			<h2>Also rising</h2>
			<p className="hs-lede">Read about far more than usual, nothing said about them yet.</p>
			<ol>
				{titles.map((t) => (
					<li key={keyOf(t)} id={keyOf(t)}>
						<Link to={hrefOf(t)} discover="none">
							{t.poster ? <img src={tmdb(t.poster, "w92")} alt="" /> : <span className="tn-noposter" />}
							<span>
								<b>
									{t.rank}. <Name title={t} />
								</b>
								<small>{t.reason ? reasonLabel(t.reason, t.mediaType) : kind(t)}</small>
							</span>
							<Spark title={t} day={day} width={72} height={26} mark={false} />
							<em>{liftLabel(t.lift)}</em>
						</Link>
					</li>
				))}
			</ol>
		</section>
	)
}

// A: Magazine.
function Magazine({ said, day }: { said: TalkedTitle[]; day: string }) {
	return (
		<div className="hs-mag">
			{said.map((t) => (
				<article key={keyOf(t)} id={keyOf(t)} className={`hs-mag-item${t.rank <= 3 ? " hs-big" : ""}`}>
					<aside className="hs-mag-side">
						<Link to={hrefOf(t)} discover="none" className="hs-mag-poster">
							{t.poster && <img src={tmdb(t.poster, "w342")} alt="" loading="lazy" />}
							<b className="hs-rank-badge">{t.rank}</b>
						</Link>
					</aside>
					<div className="hs-mag-main">
						<header>
							<p className="tn-rank">
								#{t.rank} talked about <Move move={t.move} />
							</p>
							<h2>
								<Link to={hrefOf(t)} discover="none">
									<Name title={t} />
								</Link>
								<Score title={t} />
							</h2>
							<p className="hs-meta">
								{kind(t)}
								{t.extra?.tagline ? <i> · {t.extra.tagline}</i> : null}
							</p>
							<Reason title={t} />
						</header>
						<div className="hs-mag-curve">
							<div>
								<p className="tn-lift">
									{liftLabel(t.lift)}
									<small>its usual</small>
								</p>
								<p className="hs-reads">
									{compact(t.views)} Wikipedia reads on {dateLabel(day)}
									<br />
									{compact(t.usual)} on a usual day
								</p>
							</div>
							<Spark title={t} day={day} width={640} height={72} hover />
						</div>
						<div className="hs-masonry">
							{t.items.map((item) => (
								<div key={item.id}>
									<Post item={item} title={t} />
								</div>
							))}
						</div>
					</div>
				</article>
			))}
		</div>
	)
}

// B: Shelves.
function Shelves({ said, day }: { said: TalkedTitle[]; day: string }) {
	return (
		<div className="hs-shelves">
			{said.map((t) => (
				<section key={keyOf(t)} id={keyOf(t)} className="hs-shelf">
					<header className="hs-band">
						{t.backdrop && <img src={tmdb(t.backdrop, "w1280")} alt="" loading="lazy" />}
						<div className="hs-band-in">
							<b className="hs-band-rank">{t.rank}</b>
							<div>
								<h2>
									<Link to={hrefOf(t)} discover="none">
										<Name title={t} />
									</Link>
									<Move move={t.move} />
									<Score title={t} />
								</h2>
								<p className="hs-meta">
									{kind(t)} · {t.items.length} {t.items.length === 1 ? "post" : "posts"}
								</p>
								<Reason title={t} />
							</div>
						</div>
						<div className="hs-band-buzz">
							<p className="tn-lift">
								{liftLabel(t.lift)}
								<small>its usual</small>
							</p>
							<Spark title={t} day={day} width={220} height={48} hover />
						</div>
					</header>
					<div className="hs-shelf-row">
						{t.items.map((item) => (
							<div key={item.id} className={item.source === "youtube" ? "hs-wide" : ""}>
								<Post item={item} title={t} />
							</div>
						))}
					</div>
				</section>
			))}
		</div>
	)
}

// C: Feed.
function Feed({ said, day }: { said: TalkedTitle[]; day: string }) {
	const [only, setOnly] = useState<string | null>(null)
	const posts = useMemo(
		() =>
			said
				.flatMap((t) => t.items.map((item) => ({ item, title: t })))
				.filter((p) => !only || keyOf(p.title) === only)
				.sort((a, b) => b.item.at.localeCompare(a.item.at)),
		[said, only],
	)
	return (
		<div className="hs-feedc">
			<ol className="tn-board hs-feedc-board">
				<li>
					<button type="button" className="tn-row hs-all" aria-pressed={!only} onClick={() => setOnly(null)}>
						All titles <small>{said.reduce((n, t) => n + t.items.length, 0)} posts</small>
					</button>
				</li>
				{said.map((t) => (
					<li key={keyOf(t)}>
						<button
							type="button"
							className="tn-row"
							aria-pressed={only === keyOf(t)}
							onClick={() => setOnly(only === keyOf(t) ? null : keyOf(t))}
						>
							<b className="tn-n">{t.rank}</b>
							{t.poster ? <img src={tmdb(t.poster, "w92")} alt="" width={34} height={51} /> : <span className="tn-noposter" />}
							<span className="tn-row-text">
								<b className="tn-row-title">
									<span>
										<Name title={t} />
									</span>
									<Move move={t.move} />
								</b>
								<span className="tn-row-why">
									<span>{t.items.length === 1 ? "1 post" : `${t.items.length} posts`}</span>
								</span>
							</span>
							<span className="tn-row-lift">
								<b>{liftLabel(t.lift)}</b>
							</span>
						</button>
					</li>
				))}
			</ol>
			<ol className="hs-stream">
				{posts.map(({ item, title }) => (
					<li key={`${keyOf(title)}-${item.id}`}>
						<Link to={`#${keyOf(title)}`} onClick={() => setOnly(keyOf(title))} className="hs-stream-title">
							{title.poster && <img src={tmdb(title.poster, "w92")} alt="" />}
							<span>
								<b>
									<Name title={title} />
								</b>
								<small>
									#{title.rank} · {liftLabel(title.lift)}
								</small>
							</span>
							<SourceMark source={item.source} />
						</Link>
						<Post item={item} title={title} />
					</li>
				))}
			</ol>
		</div>
	)
}

export default function HotOnSocialsPrototype() {
	const { row } = useLoaderData<typeof loader>() as { row: TalkedRow | null }
	const [params] = useSearchParams()
	const variant = params.get("variant") ?? "A"
	if (!row?.titles.length)
		return (
			<div className="lrb hs">
				<p className="lrb-in">No ranking today. Is the buzz snapshot there?</p>
			</div>
		)
	const said = row.titles.filter((t) => t.items.length > 0)
	const quiet = row.titles.filter((t) => t.items.length === 0)
	return (
		<div className="lrb hs">
			<div className="tn lrb-in hs-in">
				<Head row={row} said={said} />
				{variant !== "C" && <Strip titles={said} />}
				{variant === "B" ? (
					<Shelves said={said} day={row.day} />
				) : variant === "C" ? (
					<Feed said={said} day={row.day} />
				) : (
					<Magazine said={said} day={row.day} />
				)}
				<AlsoRising titles={quiet} day={row.day} />
			</div>
			<PrototypeSwitcher variants={VARIANTS} />
		</div>
	)
}
