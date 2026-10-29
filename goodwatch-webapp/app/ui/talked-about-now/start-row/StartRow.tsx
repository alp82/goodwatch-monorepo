// "Hot on socials" on the start page (#557): the eight titles read about most against their own usual, and one
// thing said about the chosen one. From 1024 px a panel stands beside the board, exactly as tall as the board
// whatever it holds (`contain: size` in start-row.css), so pressing a row never moves the page. Below 1024 px
// there is no panel: each row goes to that title on the Hot on socials page (routes/hot-on-socials.tsx), which
// has every post. The heading's link goes there too.
//
// Rendered with the start page and its loader data, before the visitor scrolls. Its styles are in start-row.css,
// which the start page links with its own sheets (living-room/home-sheets.ts), and the Hot on socials page itself.
import { Link } from "@remix-run/react"
import { useState } from "react"
import {
	type TalkedRow,
	type TalkedTitle,
	previewOf,
} from "~/domain/talked-about-now"
import MediaText from "~/ui/media-text/MediaText"
import { mediaFieldLanguage } from "~/utils/media-presentation"
import { Move, ReasonIcon, backupSources, buzzLabel, hrefOf, isBackup, isMultiple, tmdb, why } from "../parts"
import { Platform, SourceMark } from "./Items"
import { Spark } from "./Spark"

/** The Hot on socials page, opened at a title when one is given. */
export const pageHref = (title?: TalkedTitle) =>
	`/hot-on-socials${title ? `#${title.mediaType}-${title.tmdbId}` : ""}`

const Name = ({ title }: { title: TalkedTitle }) => (
	<MediaText value={{ text: title.title, lang: mediaFieldLanguage(title, "title") }} />
)

/** One thing said, as plain text: the headline, the video's title, or the post. */
function Said({ title }: { title: TalkedTitle }) {
	const pick = previewOf(title.items)
	if (!pick) return <span className="tn-said tn-quiet">Nothing said yet beyond the reading spike</span>
	return (
		<span className="tn-said">
			<SourceMark source={pick.source} />
			<span>
				{pick.source === "bluesky" || pick.source === "mastodon" ? `“${pick.text}”` : pick.text}
				<small> {pick.source === "rss" ? pick.publisher : pick.author}</small>
			</span>
		</span>
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
				<b>{buzzLabel(title)}</b>
			</span>
		</>
	)
}

function Panel({ title, day }: { title: TalkedTitle; day: string }) {
	return (
		<article className="tn-panel">
			{title.backdrop && <img src={tmdb(title.backdrop, "w780")} alt="" />}
			<div className="tn-panel-in">
				<p className="tn-rank">
					#{title.rank} talked about <Move move={title.move} />
				</p>
				<Link to={hrefOf(title)} discover="none" className="tn-panel-name">
					<Name title={title} />
				</Link>
				<p className="tn-panel-why">
					{title.reason && <ReasonIcon kind={title.reason.kind} />}
					{why(title)}
				</p>
				<div className="tn-panel-buzz">
					<p className="tn-lift">
						{buzzLabel(title)}
						{isMultiple(title) && <small>its usual</small>}
					</p>
					<Spark title={title} day={day} width={220} height={52} />
				</div>
				<Said title={title} />
				<Link to={pageHref(title)} className="tn-more tn-panel-more">
					{title.items.length > 1 ? `See all ${title.items.length} posts →` : "See the buzz →"}
				</Link>
			</div>
		</article>
	)
}

function Board({ row }: { row: TalkedRow }) {
	const [lead, setLead] = useState(0)
	const featured = row.titles[lead] ?? row.titles[0]
	const sources = [...new Set(row.titles.flatMap((t) => t.items.map((i) => i.source)))]
	return (
		<section aria-labelledby="tn-title" className="tn">
			<header className="tn-top">
				<div>
					<p className="lrb-eye">Talked about now</p>
					<h2 id="tn-title">Hot</h2>
					{isBackup(row) && (
						<p className="tn-backup">From {backupSources(row)} while Wikipedia's reading figures are late</p>
					)}
				</div>
				<div className="tn-head-end">
					{sources.length > 0 && (
						<p className="tn-sources">
							{sources.map((source) => (
								<Platform key={source} source={source} />
							))}
						</p>
					)}
					<Link to={pageHref()} className="tn-more">
						All the buzz →
					</Link>
				</div>
			</header>
			<div className="tn-split">
				<ol className="tn-board">
					{row.titles.map((title, i) => (
						<li key={`${title.mediaType}-${title.tmdbId}`}>
							<button
								type="button"
								onClick={() => setLead(i)}
								aria-pressed={lead === i}
								className="tn-row tn-wide-only"
							>
								<RowInner title={title} day={row.day} />
							</button>
							<Link to={pageHref(title)} className="tn-row tn-narrow-only">
								<RowInner title={title} day={row.day} />
							</Link>
						</li>
					))}
				</ol>
				<Panel title={featured} day={row.day} />
			</div>
		</section>
	)
}

export default function StartRow({ row }: { row: TalkedRow }) {
	if (!row.titles.length) return null
	return <Board row={row} />
}
