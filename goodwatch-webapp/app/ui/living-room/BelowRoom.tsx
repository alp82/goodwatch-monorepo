import { TASTE_FALLBACK_PATH } from "~/domain/member-paths"
import type { TalkedRow } from "~/domain/talked-about-now"
import { canonicalMediaTitle } from "~/utils/media-presentation"
// The section below the living room (#352): the start titles and the ways to browse GoodWatch, as plain
// links in the server HTML. It is ordinary page content right after the room. Its top edge, the lip, lies over the
// room's bottom edge and is the way down; `use-below-room.ts` owns how the page moves between the two.
//
// Every title and hub is an `<a href>` with its name as text: the start page is the page a crawler reads most, and
// this is where it finds the rest of the site. The titles are the browse poster cards (MovieTvCard), whose link text
// is the title and year, read out but not drawn, as on every other poster grid. The section's own styles are in
// living-room.css (`.lrb`), with short class names because the HTML has a byte budget.
import { Link } from "@remix-run/react"
import { type MouseEvent, type ReactNode, useMemo } from "react"
import type { NewWeekRow } from "~/server/new-on-services-page.server"
import { MovieTvCard } from "~/ui/MovieTvCard"
import { StartRowSlot } from "~/ui/talked-about-now/start-row/StartRowSlot"
import {
	HiddenTileContext,
	useKeptCards,
} from "~/ui/title-actions/hide-feedback"
import { titleToDashed } from "~/utils/helpers"
import type { SizeRule } from "~/utils/tmdb-image"
import { titleKey } from "~/utils/title-key"
import type { StartTitle } from "./living-room-data"
import { BELOW_ID, ROOM_ID } from "./use-below-room"

export const startTitleHref = (
	title: Pick<StartTitle, "media_type" | "tmdb_id" | "title">,
) =>
	`/${title.media_type}/${title.tmdb_id}-${titleToDashed(canonicalMediaTitle(title))}`

/** The widest a start poster is drawn: the cards of the grid are 105 to 140 px wide, so w154 at 1x and w342 at 2x. */
export const START_POSTER_MAX_WIDTH = 140
/** How wide a poster is drawn: three a row on a phone, four from 640 px, six from 900 px, eight from 1100 px. */
const START_POSTER_SIZES: SizeRule[] = [
	["(min-width: 1100px)", "140px"],
	["(min-width: 900px)", "15vw"],
	["(min-width: 640px)", "22vw"],
	[null, "30vw"],
]

/** The member's row of new arrivals: three a row on a phone, six from 640 px across at most 76rem of content. */
const NEW_POSTER_SIZES: SizeRule[] = [
	["(min-width: 1216px)", "190px"],
	["(min-width: 640px)", "15vw"],
	[null, "30vw"],
]

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
		href: TASTE_FALLBACK_PATH,
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
	/** "Talked about now" at the top of the section (#557); ready in the server HTML. */
	talked?: TalkedRow | null
	onDown?: (e: MouseEvent) => void
	onBack?: (e: MouseEvent) => void
	/** Content at the top of the section, before the titles: "How GoodWatch works" for a guest. */
	intro?: ReactNode
	/** A member's arrivals on their services this week (#489); null for a guest and when there are none. */
	newOn?: NewWeekRow | null
}

/**
 * The start titles as the browse poster cards, the grid Discover has: the poster links to the title page, with the
 * title and year as the link's text for a screen reader and a crawler. Every poster loads lazily (the grid is below
 * the room), and the card's actions load at the first interaction. The list is the same after a reload, so a card
 * marked Not interested keeps its place with Undo; `useKeptCards` holds it there should the list change meanwhile.
 */
function StartTitleGrid({ titles }: { titles: StartTitle[] }) {
	const keyed = useMemo(
		() =>
			titles.map((title) => ({
				key: titleKey(title.media_type, title.tmdb_id),
				title,
			})),
		[titles],
	)
	const { cards, keeper } = useKeptCards(keyed)
	return (
		<HiddenTileContext.Provider value={keeper}>
			<ol className="lrb-titles">
				{cards.map(({ key, title }) => (
					<li key={key}>
						<MovieTvCard
							details={title}
							mediaType={title.media_type}
							discover="none"
							posterSizes={START_POSTER_SIZES}
							posterMaxWidth={START_POSTER_MAX_WIDTH}
						/>
					</li>
				))}
			</ol>
		</HiddenTileContext.Provider>
	)
}

/**
 * A member's arrivals this week on their own services (#489), the best first, as the browse poster cards with the
 * service each arrived on leading (`newOn`), and See all to their page at /new. Six: two rows of three on a phone,
 * one row of six from 640 px (living-room.css `.lrb-new`).
 */
function NewOnYourServices({ row }: { row: NewWeekRow }) {
	return (
		<section aria-labelledby="new-on-yours" className="lrb-new">
			<header className="lrb-head">
				<div>
					<p className="lrb-eye">This week</p>
					<h2 id="new-on-yours">New on your services</h2>
				</div>
				<Link to="/new" prefetch="intent" className="lrb-back">
					See all{row.total > row.titles.length ? ` ${row.total}` : ""}{" "}
					<span aria-hidden>→</span>
				</Link>
			</header>
			<ol className="lrb-titles">
				{row.titles.map((title) => {
					// Every service that carries it in the member's country; `newOn` leads with the one it arrived on.
					const offers = (title.offers ?? [title.service]).flatMap((id) => {
						const service = row.services[id]
						return service ? [{ id, name: service.name, logo_path: service.logo_path }] : []
					})
					return (
						<li key={title.key}>
							<MovieTvCard
								details={{
									tmdb_id: title.tmdb_id,
									title: title.title,
									release_year: title.release_year,
									poster_path: title.poster_path,
									goodwatch_overall_score_normalized_percent: title.score,
									streaming_links: offers,
								}}
								mediaType={title.media_type}
								discover="none"
								posterSizes={NEW_POSTER_SIZES}
								newOn={title.service}
							/>
						</li>
					)
				})}
			</ol>
		</section>
	)
}

export function BelowRoom({
	titles,
	talked = null,
	onDown,
	onBack,
	intro,
	newOn = null,
}: BelowRoomProps) {
	const back = (
		<a href={`#${ROOM_ID}`} onClick={onBack} className="lrb-back">
			<span aria-hidden>↑</span> Back to Home
		</a>
	)
	return (
		<section id={BELOW_ID} aria-labelledby="browse-title" className="lrb">
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
				{newOn && <NewOnYourServices row={newOn} />}
				{talked && <StartRowSlot row={talked} />}
				<header className="lrb-head">
					<div>
						<p className="lrb-eye">On GoodWatch now</p>
						<h2 id="browse-title">
							{titles.length ? "Popular right now" : "Browse GoodWatch"}
						</h2>
					</div>
					{back}
				</header>
				{titles.length > 0 && <StartTitleGrid titles={titles} />}
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
										<li
											key={link.href}
											className={`lrb-by-${link.href.split("/").at(-1)}`}
										>
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
