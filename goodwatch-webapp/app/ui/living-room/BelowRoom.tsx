import { canonicalMediaTitle } from "~/utils/media-presentation"
import { mediaFieldLanguage } from "~/utils/media-presentation"
// The section below the living room (#352): the start titles and the ways to browse GoodWatch, as plain
// links in the server HTML. It is ordinary page content right after the room. Its top edge, the lip, lies over the
// room's bottom edge and is the way down; `use-below-room.ts` owns how the page moves between the two.
//
// Every title and hub is a visible `<a href>` with its name as text: the start page is the page a crawler reads
// most, and this is where it finds the rest of the site. Styles are in living-room.css (`.lrb`), with short class
// names because the HTML has a byte budget.
import { Link } from "@remix-run/react"
import type { MouseEvent, ReactNode } from "react"
import { StartRowSlot } from "~/ui/talked-about-now/start-row/StartRowSlot"
import { titleToDashed } from "~/utils/helpers"
import MediaText from "~/ui/media-text/MediaText"
import type { StartTitle } from "./living-room-data"
import { BELOW_ID, ROOM_ID } from "./use-below-room"

export const startTitleHref = (
	title: Pick<StartTitle, "media_type" | "tmdb_id" | "title">,
) => `/${title.media_type}/${title.tmdb_id}-${titleToDashed(canonicalMediaTitle(title))}`

/** "Movie · 2026": what the title is, quietly, under its name. */
export const startTitleLine = (
	title: Pick<StartTitle, "media_type" | "release_year">,
) =>
	`${title.media_type === "movie" ? "Movie" : "TV show"}${title.release_year ? ` · ${title.release_year}` : ""}`

/** The poster's box: the cards of the poster grid are 105 to 140 px wide, so w154 at 1x and w342 at 2x. */
export const START_POSTER = { width: 154, height: 231 }
/** How wide a poster is drawn: three a row on a phone, four from 640 px, six from 900 px, eight from 1100 px. */
const START_POSTER_SIZES = "(min-width: 1100px) 140px, (min-width: 900px) 15vw, (min-width: 640px) 22vw, 30vw"
const poster = (path: string, size: string) =>
	`https://image.tmdb.org/t/p/${size}${path}`

export const MAIN_HUBS = [
	{
		href: "/discover",
		label: "Discover",
		line: "Filter by mood, genre, score, and service.",
	},
	{ href: "/movies", label: "Movies", line: "Films worth your evening." },
	{ href: "/shows", label: "TV shows", line: "A series to start next." },
	{
		href: "/explorer",
		label: "Explorer",
		line: "A map of titles that belong together.",
	},
	{
		href: "/taste",
		label: "Taste",
		line: "Rate a few, get picks made for you.",
	},
	{
		href: "/how-it-works",
		label: "How it works",
		line: "One score, a fingerprint, where it streams.",
	},
]

export const CATEGORY_HUBS = [
	{
		label: "Movies",
		links: [
			{ href: "/movies/moods", label: "Movies by mood" },
			{ href: "/movies/genres", label: "Movies by genre" },
			{ href: "/movies/streaming", label: "Movies by streaming service" },
		],
	},
	{
		label: "TV shows",
		links: [
			{ href: "/shows/moods", label: "Shows by mood" },
			{ href: "/shows/genres", label: "Shows by genre" },
			{ href: "/shows/streaming", label: "Shows by streaming service" },
		],
	},
]

export type BelowRoomProps = {
	/** Most popular first; empty while the title snapshot loads. */
	titles: StartTitle[]
	/** "Talked about now" at the top of the section (#557); it loads once the visitor goes below. */
	talked?: boolean
	onDown?: (e: MouseEvent) => void
	onBack?: (e: MouseEvent) => void
	/** PROTOTYPE (landing): content at the top of the section, before the titles. */
	intro?: ReactNode
}

export function BelowRoom({
	titles,
	talked = false,
	onDown,
	onBack,
	intro,
}: BelowRoomProps) {
	const back = (
		<a href={`#${ROOM_ID}`} onClick={onBack} className="lrb-back">
			<span aria-hidden>↑</span> Back to Home
		</a>
	)
	return (
		<section
			id={BELOW_ID}
			aria-labelledby="browse-title"
			className="lrb"
		>
			<a href={`#${BELOW_ID}`} onClick={onDown} className="lrb-lip">
				<span>
					{/* An invitation, not the list's name: the heading under it has that. */}
					<b>More below</b>
					<small>
						{titles.length
							? `${titles.length} popular titles`
							: "Movies and shows"}
						<u> and every way to browse</u>
					</small>
				</span>
				<i aria-hidden />
			</a>
			<div className="lrb-in">
				{intro}
				{talked && <StartRowSlot />}
				<header className="lrb-head">
					<div>
						<p className="lrb-eye">On GoodWatch tonight</p>
						<h2 id="browse-title">
							{titles.length ? "Popular right now" : "Browse GoodWatch"}
						</h2>
					</div>
					{back}
				</header>
				{titles.length > 0 && (
					<ol className="lrb-titles">
						{titles.map((title) => (
							<li key={`${title.media_type}-${title.tmdb_id}`}>
								{title.poster_path && (
									<img
										src={poster(title.poster_path, "w154")}
										srcSet={`${poster(title.poster_path, "w154")} 154w, ${poster(title.poster_path, "w342")} 342w`}
										sizes={START_POSTER_SIZES}
										width={START_POSTER.width}
										height={START_POSTER.height}
										alt={`${title.title} poster`}
										loading="lazy"
										decoding="async"
									/>
								)}
								<Link to={startTitleHref(title)} discover="none">
									<MediaText value={{ text: title.title, lang: mediaFieldLanguage(title) }} />
								</Link>
								<span>{startTitleLine(title)}</span>
							</li>
						))}
					</ol>
				)}
				<div className="lrb-hubs">
					{titles.length > 0 && <h2>Browse GoodWatch</h2>}
					<ul className="lrb-cards">
						{MAIN_HUBS.map((hub) => (
							<li key={hub.href} className={`lrb-hub-${hub.href.slice(1)}`}>
								<Link to={hub.href} discover="none">
									<b>{hub.label}</b>
									<span>{hub.line}</span>
								</Link>
							</li>
						))}
					</ul>
					<div className="lrb-by">
						{CATEGORY_HUBS.map((group) => (
							<div key={group.label} className="lrb-group">
								<h3>{group.label}</h3>
								<ul>
									{group.links.map((link) => (
										<li key={link.href} className={`lrb-by-${link.href.split("/").at(-1)}`}>
											<Link to={link.href} discover="none">
												{link.label}
											</Link>
										</li>
									))}
								</ul>
							</div>
						))}
					</div>
				</div>
				<p className="lrb-end">{back}</p>
			</div>
		</section>
	)
}
