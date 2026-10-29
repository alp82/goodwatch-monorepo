// The "Go deeper" doors under a member's start: Continue watching, Wishlist, For you, Hot on socials. Pure, so the
// order, the open door and the grid's rows are tested without React (doors.test.ts); Doors.tsx draws them.
//
// - The doors follow what the member has: doors with titles first, in their usual order, then the doors with none,
//   in the same order. The first door is open on load (decided from the data alone, so the server renders it).
// - For you and Hot on socials can still be on their way (member.server.ts): such a door counts as one with titles,
//   since it is only read when it is expected to have some, so the order and the open door are known before it
//   arrives and don't change when it does. The open door is never on its way: the server waits for it.
// - An open section with few or no titles says why in one slim strip and where to go next, then shows one grid where
//   the posters, "add more" ghosts and the page tile always fill whole rows at every width.
import type { TitleCard } from "~/server/title-cards.server"
import {
	MEMBER_LIST_SIZE,
	type MemberStartData,
	PERSONAL_AT,
} from "./member-data"

export type DoorKey = "continue" | "wishlist" | "forYou" | "hot"

export type Cta = { label: string; href: string }

/** The pages the doors and their strips lead to. */
export const MEMBER_HREF = {
	shows: "/my-shows",
	movies: "/my-movies",
	forYou: "/for-you",
	hot: "/hot-on-socials",
	watchNext: "/watch-next",
	taste: "/taste",
	imports: "/settings/imports",
	findShow: "/discover?type=show",
	discover: "/discover",
}

const BRING: Cta = { label: "Bring your ratings", href: MEMBER_HREF.imports }
const RATE: Cta = { label: "Rate a few titles", href: MEMBER_HREF.taste }

/** A poster in a door's grid, with the line under it: the next episode, or a hot title's place and why. */
export type DoorTitle = {
	card: TitleCard
	line?: { text: string; rank?: number }
}

export type Strip = {
	title: string
	body?: string
	/** "4 of 10 ratings" with a bar. */
	progress?: number
	ctas: Cta[]
}

export type Door = {
	key: DoorKey
	label: string
	/** The door's one fixed line: its count, or why it is empty. */
	line: string
	titles: DoorTitle[]
	/** How many titles the list has in all. */
	total: number
	href: string
	/** The page's name for the header link and the end tile. */
	pageName: string
	/** Whether the end tile can promise a count (For you and Hot on socials keep going). */
	counted: boolean
	/** The line under the section's heading while it has titles. */
	note: string
	/** What the section says above its grid; null when the titles say it all. */
	strip: Strip | null
	/** The "add more" ghost that fills a short grid's row; null: a short grid drops titles to fill its rows instead. */
	ghost: Cta | null
	/** Movies and shows, or a movie's length: chips inside a full section. */
	filters: DoorFilter[] | null
	/** Its list is still on its way. */
	pending: boolean
}

export type DoorFilter = {
	key: string
	label: string
	keep: (card: TitleCard) => boolean
}

const ALL: DoorFilter = { key: "all", label: "All", keep: () => true }

const plural = (n: number, one: string, many = `${one}s`) =>
	`${n} ${n === 1 ? one : many}`

const UNREAD: Strip = {
	title: "Couldn't load this right now",
	body: "Reload the page to try again.",
	ctas: [],
}

/** The four doors, in their usual order. Hot on socials only when the member sees it. */
export function doorsOf(data: MemberStartData): Door[] {
	const forming = data.ratings < PERSONAL_AT
	const shows = data.continue
	const movies = data.wishlist
	const forYou = data.forYou
	const hot = data.hot
	const doors: Door[] = [
		{
			key: "continue",
			label: "Continue watching",
			line: shows?.total ? plural(shows.total, "show") : "No shows yet",
			titles: (shows?.titles ?? []).map((show) => ({
				card: show.card,
				...(show.episode ? { line: { text: show.episode } } : {}),
			})),
			total: shows?.total ?? 0,
			href: MEMBER_HREF.shows,
			pageName: "My shows",
			counted: true,
			note: "The next episode of each show you're watching",
			strip: !shows
				? UNREAD
				: shows.titles.length
					? null
					: {
							title: "No shows yet",
							body: "Track a show and its next episode waits here.",
							ctas: [
								{ label: "Find a show", href: MEMBER_HREF.findShow },
								BRING,
							],
						},
			ghost: { label: "Track a show", href: MEMBER_HREF.findShow },
			filters: null,
			pending: false,
		},
		{
			key: "wishlist",
			label: "Wishlist",
			line: movies?.total ? plural(movies.total, "movie") : "Nothing saved yet",
			titles: (movies?.titles ?? []).map((card) => ({ card })),
			total: movies?.total ?? 0,
			href: MEMBER_HREF.movies,
			pageName: "My movies",
			counted: true,
			note: "Your Wishlist, best for tonight first",
			strip: !movies
				? UNREAD
				: movies.titles.length
					? null
					: {
							title: "Your Wishlist is empty",
							body: "Tap Want to See on any movie and it lands here.",
							ctas: [
								{ label: "Browse Discover", href: MEMBER_HREF.discover },
								{ label: "See For you", href: MEMBER_HREF.forYou },
							],
						},
			ghost: { label: "Save a movie", href: MEMBER_HREF.discover },
			filters: [
				ALL,
				{
					key: "short",
					label: "Under 2 hours",
					keep: (c) => !!c.runtime && c.runtime < 120,
				},
				{
					key: "long",
					label: "2 hours or more",
					keep: (c) => !!c.runtime && c.runtime >= 120,
				},
			],
			pending: false,
		},
		{
			key: "forYou",
			label: "For you",
			line: forming
				? data.ratings > 0
					? `${data.ratings} of ${PERSONAL_AT} ratings`
					: "Needs ratings"
				: "Your taste",
			titles: (forYou?.titles ?? []).map((card) => ({ card })),
			total: forYou?.total ?? 0,
			href: MEMBER_HREF.forYou,
			pageName: "For you",
			counted: false,
			note: forming
				? "First guesses while your taste forms"
				: "Movies and shows picked for your taste",
			// While For you is forming, its strip says so, with or without first guesses.
			strip:
				forYou === null
					? UNREAD
					: forming
						? {
								title: `Picks get personal at ${PERSONAL_AT} ratings`,
								progress: data.ratings,
								ctas: [RATE, BRING],
							}
						: !forYou || forYou.titles.length
							? null
							: {
									title: "Nothing to pick yet",
									body: "Rate a few more titles and your picks show here.",
									ctas: [RATE],
								},
			ghost: { label: "Rate more to unlock", href: MEMBER_HREF.taste },
			filters: [
				ALL,
				{
					key: "movie",
					label: "Movies",
					keep: (c) => c.media_type === "movie",
				},
				{ key: "show", label: "Shows", keep: (c) => c.media_type === "show" },
			],
			pending: forYou === undefined,
		},
	]
	if (data.hotOn)
		doors.push({
			key: "hot",
			label: "Hot on socials",
			line: hot?.titles.length
				? `Top ${hot.titles.length} right now`
				: hot === undefined
					? "Right now"
					: "Nothing yet",
			titles: (hot?.titles ?? []).map((title) => ({
				card: title.card,
				line: { text: title.why, rank: title.rank },
			})),
			total: hot?.total ?? 0,
			href: MEMBER_HREF.hot,
			pageName: "Hot on socials",
			counted: false,
			note: "Most talked about right now, and why",
			strip:
				hot === null
					? UNREAD
					: !hot || hot.titles.length
						? null
						: {
								title: "Nothing measured yet today",
								body: "The ranking updates once a day.",
								ctas: [{ label: "Open Hot on socials", href: MEMBER_HREF.hot }],
							},
			ghost: null,
			filters: null,
			pending: hot === undefined,
		})
	return doors
}

/** A door with titles, or one whose list is on its way (it is only read when it is expected to have some). */
const filled = (door: Door) => door.pending || door.titles.length > 0

/** The doors with titles first, each group in the usual order. The first one is open on load. */
export function orderDoors(doors: readonly Door[]): Door[] {
	return [...doors.filter(filled), ...doors.filter((door) => !filled(door))]
}

/** The door open on load. */
export const openDoorOf = (data: MemberStartData): DoorKey =>
	orderDoors(doorsOf(data))[0].key

/** Filter chips only once a section has a full grid of titles; a handful needs no sorting. */
export const FILTERS_FROM = MEMBER_LIST_SIZE

export const filtersOf = (door: Door) =>
	door.filters && door.titles.length >= FILTERS_FROM ? door.filters : null

// ---------------------------------------------------------------------------------------------------------------------
// The grid: whole rows at every width

/** The grid's columns on phones, from 640 px (sm), and from 1024 px (lg). */
export const GRID_COLUMNS = [3, 4, 6] as const

/** The grid's size: eleven posters and the page tile, whole rows at three, four and six across. */
const GRID = MEMBER_LIST_SIZE

/** A full grid's cells (what a list on its way reserves). */
export const GRID_CELLS = GRID

export type GridPlan = {
	posters: number
	ghosts: number
	/** Quiet empty slots that close a short row where no "add more" ghost fits (Hot on socials, a filtered view). */
	blanks: number
	tile: boolean
}

/**
 * How many posters, ghosts, blanks and the end tile one width shows, so every row is full:
 * - a full section: eleven posters and the tile;
 * - a short section with a ghost: every poster, then ghosts to the end of the row, then the tile; when that would be
 *   a row of mostly ghosts under full rows, fewer posters instead, so the tile closes the last full row;
 * - a short section without a ghost (Hot on socials, a filtered view): as many posters as fill whole rows with the
 *   tile; fewer posters than one row are kept, and quiet blanks close their row before the tile;
 * - an empty section: nothing (its strip says it all).
 */
export function gridPlan(n: number, columns: number, ghost: boolean): GridPlan {
	const none = { posters: 0, ghosts: 0, blanks: 0, tile: false }
	if (n === 0) return none
	if (n >= GRID - 1) return { ...none, posters: GRID - 1, tile: true }
	if (ghost) {
		const slots = Math.ceil((n + 1) / columns) * columns
		const ghosts = slots - n - 1
		if (n >= columns && ghosts >= columns / 2)
			return { ...none, posters: slots - columns - 1, tile: true }
		return { ...none, posters: n, ghosts, tile: true }
	}
	if (n + 1 <= columns)
		return { ...none, posters: n, blanks: columns - n - 1, tile: true }
	return {
		...none,
		posters: Math.floor((n + 1) / columns) * columns - 1,
		tile: true,
	}
}

/** All the cells one width shows. */
export const cellsOf = (plan: GridPlan) =>
	plan.posters + plan.ghosts + plan.blanks + (plan.tile ? 1 : 0)

/** The end tile's two lines: a count only when the tile stands for more titles than the grid shows. */
export function tileText(
	door: Door,
	shown: number,
): { top: string; sub: string } {
	if (door.key === "hot") return { top: "See all", sub: `on ${door.pageName}` }
	if (!door.counted) return { top: "More", sub: `in ${door.pageName}` }
	if (door.total >= GRID - 1 || door.total > shown)
		return { top: `See all ${door.total}`, sub: `in ${door.pageName}` }
	return { top: "Open", sub: door.pageName }
}
