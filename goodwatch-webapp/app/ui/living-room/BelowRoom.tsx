// The section below a guest's living room (#352): the start titles and the ways to browse GoodWatch, as plain
// links in the server HTML. It is ordinary page content right after the room. Its top edge, the lip, lies over the
// room's bottom edge and is the one way down; `use-below-room.ts` owns where the visitor is.
//
// Every title and hub is a visible `<a href>` with its name as text: the start page is the page a crawler reads
// most, and this is where it finds the rest of the site. Styles are in living-room.css (`.lrb`), with short class
// names because the HTML has a byte budget.
import { Link } from "@remix-run/react"
import type { MouseEvent } from "react"
import { titleToDashed } from "~/utils/helpers"
import type { StartTitle } from "./living-room-data"
import { BELOW_ID, ROOM_ID } from "./use-below-room"

export const startTitleHref = (
	title: Pick<StartTitle, "media_type" | "tmdb_id" | "title">,
) => `/${title.media_type}/${title.tmdb_id}-${titleToDashed(title.title)}`

/** "Movie · 2026": what the title is, quietly, under its name. */
export const startTitleLine = (
	title: Pick<StartTitle, "media_type" | "release_year">,
) =>
	`${title.media_type === "movie" ? "Movie" : "TV show"}${title.release_year ? ` · ${title.release_year}` : ""}`

/** The poster's width on screen: a phone at two device pixels per pixel still takes the smallest TMDB file. */
export const START_POSTER = { width: 46, height: 69 }
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
	onDown?: (e: MouseEvent) => void
	onBack?: (e: MouseEvent) => void
}

export function BelowRoom({ titles, onDown, onBack }: BelowRoomProps) {
	const back = (
		<a href={`#${ROOM_ID}`} onClick={onBack} className="lrb-back">
			<span aria-hidden>↑</span> Back to the living room
		</a>
	)
	return (
		<section id={BELOW_ID} aria-labelledby="browse-title" className="lrb">
			<a href={`#${BELOW_ID}`} onClick={onDown} className="lrb-lip">
				<span>
					<b>{titles.length ? "Popular right now" : "Browse GoodWatch"}</b>
					<small>
						{titles.length ? `${titles.length} titles` : "Movies and shows"}
						<u> and every way to browse</u>
					</small>
				</span>
				<i aria-hidden />
			</a>
			<div className="lrb-in">
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
										src={poster(title.poster_path, "w92")}
										srcSet={`${poster(title.poster_path, "w92")} 92w, ${poster(title.poster_path, "w154")} 154w`}
										sizes={`${START_POSTER.width}px`}
										width={START_POSTER.width}
										height={START_POSTER.height}
										alt={`${title.title} poster`}
										loading="lazy"
										decoding="async"
									/>
								)}
								<Link to={startTitleHref(title)} discover="none">
									{title.title}
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
							<li key={hub.href}>
								<Link to={hub.href} discover="none">
									<b>{hub.label}</b>
									<span>{hub.line}</span>
								</Link>
							</li>
						))}
					</ul>
					<div className="lrb-by">
						{CATEGORY_HUBS.map((group) => (
							<div key={group.label}>
								<h3>{group.label}</h3>
								<ul>
									{group.links.map((link) => (
										<li key={link.href}>
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
