// PROTOTYPE - throwaway. "Hot on socials" on the start page, simplified: three layouts that never change size when
// the visitor presses something, each with a way into the deeper page (routes/prototype.hot-on-socials.tsx).
// Switch with ?variant=A|B|C (or the floating bar). Reuses the row's own pieces: Spark, marks, reason icons.
import { Link } from "@remix-run/react"
import { useState } from "react"
import { type TalkedRow, type TalkedTitle, liftLabel, previewOf } from "~/domain/talked-about-now"
import MediaText from "~/ui/media-text/MediaText"
import { mediaFieldLanguage } from "~/utils/media-presentation"
import { Platform, SourceMark } from "./Items"
import { Spark } from "./Spark"
import { Move, ReasonIcon, hrefOf, tmdb, why } from "./StartRow"

export const HOME_VARIANTS = {
	A: "Steady split",
	B: "Poster rail",
	C: "Leader + list",
}

export const deepHref = (title?: TalkedTitle) =>
	`/prototype/hot-on-socials${title ? `#${title.mediaType}-${title.tmdbId}` : ""}`

const Name = ({ title }: { title: TalkedTitle }) => (
	<MediaText value={{ text: title.title, lang: mediaFieldLanguage(title, "title") }} />
)

/** One line of what is said, as plain text: the headline, the video's title, or the post. */
function Said({ title }: { title: TalkedTitle }) {
	const pick = previewOf(title.items)
	if (!pick) return <span className="hp-said hp-quiet">Nothing said yet beyond the reading spike</span>
	return (
		<span className="hp-said">
			<SourceMark source={pick.source} />
			<span>
				{pick.source === "bluesky" || pick.source === "mastodon" ? `“${pick.text}”` : pick.text}
				<small> {pick.source === "rss" ? pick.publisher : pick.author}</small>
			</span>
		</span>
	)
}

function Header({ row }: { row: TalkedRow }) {
	const sources = [...new Set(row.titles.flatMap((t) => t.items.map((i) => i.source)))]
	return (
		<header className="tn-top">
			<div>
				<p className="lrb-eye">Talked about now</p>
				<h2 id="tn-title">Hot on socials</h2>
			</div>
			<div className="hp-head-end">
				{sources.length > 0 && (
					<p className="tn-sources">
						{sources.map((source) => (
							<Platform key={source} source={source} />
						))}
					</p>
				)}
				<Link to={deepHref()} className="hp-more">
					All the buzz →
				</Link>
			</div>
		</header>
	)
}

// A: the board stays as it is; the featured panel beside it is exactly the board's height, whatever it holds. It
// shows one thing said, as text, and links to the deeper page for the rest. Under 1024 px there is no panel: the
// rows link to the deeper page.
function SteadySplit({ row }: { row: TalkedRow }) {
	const [lead, setLead] = useState(0)
	const title = row.titles[lead] ?? row.titles[0]
	return (
		<>
			<div className="hp-split">
				<ol className="tn-board">
					{row.titles.map((t, i) => (
						<li key={`${t.mediaType}-${t.tmdbId}`}>
							<button type="button" onClick={() => setLead(i)} aria-pressed={lead === i} className="tn-row hp-wide-only">
								<RowInner title={t} day={row.day} />
							</button>
							<Link to={deepHref(t)} className="tn-row hp-narrow-only">
								<RowInner title={t} day={row.day} />
							</Link>
						</li>
					))}
				</ol>
				<article className="hp-panel">
					{title.backdrop && <img src={tmdb(title.backdrop, "w780")} alt="" />}
					<div className="hp-panel-in">
						<p className="tn-rank">
							#{title.rank} talked about <Move move={title.move} />
						</p>
						<Link to={hrefOf(title)} discover="none" className="hp-panel-name">
							<Name title={title} />
						</Link>
						<p className="hp-panel-why">
							{title.reason && <ReasonIcon kind={title.reason.kind} />}
							{why(title)}
						</p>
						<div className="hp-panel-buzz">
							<p className="tn-lift">
								{liftLabel(title.lift)}
								<small>its usual</small>
							</p>
							<Spark title={title} day={row.day} width={220} height={52} />
						</div>
						<Said title={title} />
						<Link to={deepHref(title)} className="hp-more hp-panel-more">
							{title.items.length > 1 ? `See all ${title.items.length} posts →` : "See the buzz →"}
						</Link>
					</div>
				</article>
			</div>
		</>
	)
}

function RowInner({ title, day }: { title: TalkedTitle; day: string }) {
	return (
		<>
			<b className="tn-n">{title.rank}</b>
			{title.poster ? (
				<img src={tmdb(title.poster, "w92")} alt="" width={34} height={51} loading="lazy" />
			) : (
				<span className="tn-noposter" />
			)}
			<span className="tn-row-text">
				<b className="tn-row-title">
					<span>
						<Name title={title} />
					</span>
					<Move move={title.move} />
				</b>
				<span className="tn-row-why">
					{title.reason && <ReasonIcon kind={title.reason.kind} />}
					<span>{why(title)}</span>
				</span>
			</span>
			<span className="tn-row-spark">
				<Spark title={title} day={day} width={96} height={34} />
			</span>
			<span className="tn-row-lift">
				<b>{liftLabel(title.lift)}</b>
			</span>
		</>
	)
}

// B: eight posters in a row, all the same size, nothing to select. Each card goes to its title's buzz on the deeper
// page; the poster's name goes to the title page. Swipes on a phone.
function PosterRail({ row }: { row: TalkedRow }) {
	return (
		<ol className="hp-rail">
			{row.titles.map((t) => (
				<li key={`${t.mediaType}-${t.tmdbId}`}>
					<Link to={deepHref(t)} className="hp-card">
						<span className="hp-card-poster">
							{t.poster && <img src={tmdb(t.poster, "w342")} alt="" loading="lazy" />}
							<b className="hp-card-n">{t.rank}</b>
							<b className="hp-card-lift">{liftLabel(t.lift)}</b>
						</span>
						<span className="hp-card-spark">
							<Spark title={t} day={row.day} width={160} height={30} mark={false} />
						</span>
						<b className="hp-card-name">
							<Name title={t} />
						</b>
						<span className="hp-card-why">
							{t.reason && <ReasonIcon kind={t.reason.kind} />}
							<span>{why(t)}</span>
						</span>
						<span className="hp-card-marks">
							{t.items.map((item) => (
								<SourceMark key={item.id} source={item.source} />
							))}
							{t.items.length > 0 && <small>{t.items.length === 1 ? "1 post" : `${t.items.length} posts`}</small>}
						</span>
					</Link>
				</li>
			))}
		</ol>
	)
}

// C: the most talked about title as a wide banner, the other seven as compact rows in two columns. Nothing
// expands; every row goes to the deeper page.
function LeaderList({ row }: { row: TalkedRow }) {
	const [first, ...rest] = row.titles
	return (
		<div className="hp-leader">
			<Link to={deepHref(first)} className="hp-banner">
				{first.backdrop && <img src={tmdb(first.backdrop, "w1280")} alt="" />}
				<span className="hp-banner-in">
					<span className="tn-rank">
						#1 talked about <Move move={first.move} />
					</span>
					<b className="hp-banner-name">
						<Name title={first} />
					</b>
					<span className="hp-panel-why">
						{first.reason && <ReasonIcon kind={first.reason.kind} />}
						{why(first)}
					</span>
					<Said title={first} />
				</span>
				<span className="hp-banner-buzz">
					<span className="tn-lift">
						{liftLabel(first.lift)}
						<small>its usual</small>
					</span>
					<Spark title={first} day={row.day} width={260} height={60} />
				</span>
			</Link>
			<ol className="hp-cols">
				{rest.map((t) => (
					<li key={`${t.mediaType}-${t.tmdbId}`}>
						<Link to={deepHref(t)} className="tn-row hp-col-row">
							<RowInner title={t} day={row.day} />
						</Link>
					</li>
				))}
			</ol>
		</div>
	)
}

export function HomeVariant({ row, variant }: { row: TalkedRow; variant: string }) {
	return (
		<section aria-labelledby="tn-title" className="tn hp">
			<Header row={row} />
			{variant === "B" ? <PosterRail row={row} /> : variant === "C" ? <LeaderList row={row} /> : <SteadySplit row={row} />}
		</section>
	)
}
