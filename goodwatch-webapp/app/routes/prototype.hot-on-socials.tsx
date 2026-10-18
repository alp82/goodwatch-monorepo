// PROTOTYPE - throwaway. The deeper "Hot on socials" page: everything the start page's simplified row leaves out.
//   /prototype/hot-on-socials?variant=A|B   (#movie-123 or #show-456 jumps to a title)
// A: one story per title, all its posts, with a sticky index of the eight. B: the board with a sticky detail panel
// of a fixed size beside it. Reads the same /api/talked-about-now as the start page (TALKED_ABOUT_NOW_ROW=on).
import type { LinksFunction } from "@remix-run/node"
import { Link, useSearchParams } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { type TalkedRow, type TalkedTitle, compact, liftLabel, reasonLabel } from "~/domain/talked-about-now"
import livingRoomCss from "~/ui/living-room/living-room.css?url"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { NativeItems, Platform } from "~/ui/talked-about-now/start-row/Items"
import { Spark, dateLabel } from "~/ui/talked-about-now/start-row/Spark"
import { Featured, Move, ReasonIcon, hrefOf, tmdb, why } from "~/ui/talked-about-now/start-row/StartRow"
import MediaText from "~/ui/media-text/MediaText"
import { mediaFieldLanguage } from "~/utils/media-presentation"
import useLocale from "~/utils/locale"
import { talkedRowQuery } from "~/utils/talked-row-query"

export async function loader() {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return null
}
export const links: LinksFunction = () => [{ rel: "stylesheet", href: livingRoomCss }]
export const shouldRevalidate = () => false
export const meta = () => [{ title: "Hot on socials (prototype) · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

const VARIANTS = { A: "Story feed", B: "Sticky detail" }
const keyOf = (t: TalkedTitle) => `${t.mediaType}-${t.tmdbId}`
const Name = ({ title }: { title: TalkedTitle }) => (
	<MediaText value={{ text: title.title, lang: mediaFieldLanguage(title, "title") }} />
)

function Head({ row }: { row: TalkedRow }) {
	const sources = [...new Set(row.titles.flatMap((t) => t.items.map((i) => i.source)))]
	return (
		<header className="tn-top">
			<div>
				<p className="lrb-eye">Talked about now · {dateLabel(row.day)}</p>
				<h1 className="hs-h1">Hot on socials</h1>
				<p className="hs-lede">
					The titles people read about most yesterday against their own usual day, and what is being said about them.
				</p>
			</div>
			{sources.length > 0 && (
				<p className="tn-sources">
					{sources.map((source) => (
						<Platform key={source} source={source} />
					))}
				</p>
			)}
		</header>
	)
}

function Story({ title, day }: { title: TalkedTitle; day: string }) {
	return (
		<article id={keyOf(title)} className="hs-story">
			<div className="hs-story-head">
				{title.backdrop && <img src={tmdb(title.backdrop, "w1280")} alt="" loading="lazy" />}
				<div>
					<p className="tn-rank">
						#{title.rank} talked about <Move move={title.move} />
					</p>
					<Link to={hrefOf(title)} discover="none" className="tn-name">
						<Name title={title} />
					</Link>
					<p className="tn-kind">
						{title.mediaType === "movie" ? "Movie" : "TV show"}
						{title.year ? ` · ${title.year}` : ""}
					</p>
				</div>
			</div>
			<div className="hs-story-body">
				<div className="hs-story-facts">
					{title.reason && (
						<span className={`tn-chip tn-chip-${title.reason.kind}`}>
							<ReasonIcon kind={title.reason.kind} />
							{reasonLabel(title.reason, title.mediaType)}, {dateLabel(title.reason.day)}
						</span>
					)}
					<p className="tn-lift">
						{liftLabel(title.lift)}
						<small>its usual</small>
					</p>
					<p className="hs-reads">
						{compact(title.views)} Wikipedia reads on {dateLabel(day)}, {compact(title.usual)} on a usual day
					</p>
					<div className="hs-story-curve">
						<Spark title={title} day={day} width={320} height={80} hover />
					</div>
				</div>
				<div className="hs-story-said">
					{title.items.length ? (
						<NativeItems items={title.items} still={title.backdrop} />
					) : (
						<p className="hp-quiet">Nothing said yet beyond the reading spike.</p>
					)}
				</div>
			</div>
		</article>
	)
}

function StoryFeed({ row }: { row: TalkedRow }) {
	return (
		<div className="hs-feed">
			<nav className="hs-index" aria-label="Titles">
				{row.titles.map((t) => (
					<a key={keyOf(t)} href={`#${keyOf(t)}`}>
						{t.poster && <img src={tmdb(t.poster, "w92")} alt="" />}
						<span>
							<b>
								{t.rank}. <Name title={t} />
							</b>
							<small>{liftLabel(t.lift)}</small>
						</span>
					</a>
				))}
			</nav>
			<div className="hs-stories">
				{row.titles.map((t) => (
					<Story key={keyOf(t)} title={t} day={row.day} />
				))}
			</div>
		</div>
	)
}

function StickyDetail({ row }: { row: TalkedRow }) {
	const [lead, setLead] = useState(0)
	useEffect(() => {
		const at = row.titles.findIndex((t) => `#${keyOf(t)}` === window.location.hash)
		if (at >= 0) setLead(at)
	}, [row])
	const title = row.titles[lead] ?? row.titles[0]
	return (
		<div className="hs-sticky">
			<ol className="tn-board">
				{row.titles.map((t, i) => (
					<li key={keyOf(t)}>
						<button type="button" onClick={() => setLead(i)} aria-pressed={lead === i} className="tn-row">
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
									{t.reason && <ReasonIcon kind={t.reason.kind} />}
									<span>{why(t)}</span>
								</span>
							</span>
							<span className="tn-row-spark">
								<Spark title={t} day={row.day} width={96} height={34} />
							</span>
							<span className="tn-row-lift">
								<b>{liftLabel(t.lift)}</b>
							</span>
						</button>
					</li>
				))}
			</ol>
			<div className="hs-sticky-panel">
				<Featured key={keyOf(title)} title={title} day={row.day} />
			</div>
		</div>
	)
}

export default function HotOnSocialsPrototype() {
	const { locale } = useLocale()
	const { data, isPending } = useQuery(talkedRowQuery(locale.language))
	const [params] = useSearchParams()
	const variant = params.get("variant") ?? "A"
	return (
		<div className="lrb hs">
			<div className="tn lrb-in">
				{isPending ? (
					<p>Loading…</p>
				) : !data?.titles.length ? (
					<p>No ranking today. Is TALKED_ABOUT_NOW_ROW=on?</p>
				) : (
					<>
						<Head row={data} />
						{variant === "B" ? <StickyDetail row={data} /> : <StoryFeed row={data} />}
					</>
				)}
			</div>
			<PrototypeSwitcher variants={VARIANTS} />
		</div>
	)
}
