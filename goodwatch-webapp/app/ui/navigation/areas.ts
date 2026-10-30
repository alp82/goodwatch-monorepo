// The three areas of the site navigation (Watch · Explore · Profile): which area a page belongs to, each area's tabs, the
// chips and switches under Watch's tabs and on Scores, and PLACES, the one list of places the account menu and the
// Settings column both draw from, so their rows match one to one. Pure: the header, the dock, the area layouts and
// the account menu read from here; AreaTabs.tsx draws the rows.
//
// The Profile area keeps the key "taste" in code (route ids, tests and the other modules name it so); only what people
// see says Profile. Someone else's profile: a member on /u/:other gets the Profile area's chrome (the key lit, the tab
// row) with the visitor's tabs and that profile's header; a guest gets the same tabs under "@other" with no area key
// lit, since a guest has no profile of their own there.
import {
	ArrowDownTrayIcon,
	ArrowUpTrayIcon,
	BookmarkIcon,
	CalendarDaysIcon,
	ChartBarIcon,
	ChatBubbleLeftEllipsisIcon,
	Cog6ToothIcon,
	EyeIcon,
	FilmIcon,
	FingerPrintIcon,
	FireIcon,
	GlobeAltIcon,
	GlobeEuropeAfricaIcon,
	InformationCircleIcon,
	KeyIcon,
	LanguageIcon,
	LifebuoyIcon,
	ListBulletIcon,
	MagnifyingGlassIcon,
	MapIcon,
	NoSymbolIcon,
	PencilSquareIcon,
	PlayIcon,
	PuzzlePieceIcon,
	QuestionMarkCircleIcon,
	ShieldCheckIcon,
	SparklesIcon,
	StarIcon,
	TagIcon,
	TrophyIcon,
	TvIcon,
	UserCircleIcon,
	UserGroupIcon,
} from "@heroicons/react/24/outline"
import {
	GlobeAltIcon as GlobeAltSolid,
	PlayIcon as PlaySolid,
	UserCircleIcon as UserCircleSolid,
} from "@heroicons/react/24/solid"
import { type ComponentType, type SVGProps, createElement } from "react"
import {
	type PathViewer,
	RATE_FALLBACK_PATH,
	SETTINGS_PATHS,
	TASTE_FALLBACK_PATH,
	WATCH_PATHS,
	handleOf,
	tasteHome,
	tastePath,
} from "../../domain/member-paths.ts"

export type NavIcon = ComponentType<SVGProps<SVGSVGElement>>

// ---------------------------------------------------------------------------------------------------------
// Areas

export type AreaKey = "watch" | "explore" | "taste"

export interface AreaDef {
	key: AreaKey
	label: string
	/** Where the area key leads this viewer: the area's first page. */
	href: string
	icon: NavIcon
	/** The filled icon of the lit key. */
	iconOn: NavIcon
}

/** The three area keys, in order, for this viewer (Profile: the profile, or /taste without a handle). */
export function areaKeys(viewer: PathViewer): AreaDef[] {
	return [
		{
			key: "watch",
			label: "Watch",
			href: WATCH_PATHS.nextEpisodes,
			icon: PlayIcon,
			iconOn: PlaySolid,
		},
		{
			key: "explore",
			label: "Explore",
			href: "/discover",
			icon: GlobeAltIcon,
			iconOn: GlobeAltSolid,
		},
		{
			key: "taste",
			label: "Profile",
			href: tasteHome(viewer),
			icon: UserCircleIcon,
			iconOn: UserCircleSolid,
		},
	]
}

const under = (pathname: string, prefix: string) =>
	pathname === prefix || pathname.startsWith(`${prefix}/`)

const EXPLORE_PREFIXES = [
	"/discover",
	"/new",
	"/hot-on-socials",
	"/movies",
	"/shows",
	"/people",
	"/explorer",
	"/explore",
]
const TASTE_PREFIXES = ["/u", "/settings", "/taste", "/lists"]

/**
 * The area a page belongs to, from its path alone: Watch for /watch/*, Explore for the browsing pages, Profile for
 * profiles (/u/:handle/*, anyone's), Settings, /taste, /taste/quiz and the list pages. Null for pages outside the
 * areas: home, title and person pages, Help and the apps pages.
 */
export function areaOf(pathname: string): AreaKey | null {
	if (under(pathname, "/watch")) return "watch"
	if (EXPLORE_PREFIXES.some((p) => under(pathname, p))) return "explore"
	if (TASTE_PREFIXES.some((p) => under(pathname, p))) return "taste"
	return null
}

/** The area key to light for this viewer: as areaOf, except a guest on a profile lights none. */
export function litArea(pathname: string, viewer: PathViewer): AreaKey | null {
	const area = areaOf(pathname)
	if (area === "taste" && viewer.kind === "guest" && under(pathname, "/u"))
		return null
	return area
}

// ---------------------------------------------------------------------------------------------------------
// Tabs, chips and switches (AreaTabs.tsx draws them)

export interface AreaTab {
	key: string
	label: string
	/** The tab's icon, left of its label (of both lines on a two-line tab). */
	icon?: NavIcon
	/** A second, smaller line under the label (Watch: "My shows", "My movies", "For you"). */
	sub?: string
	href: string
	here: boolean
	count?: number
	/** The owner's mark on a narrowed part: only you see it, or members only. */
	mark?: "me" | "members"
	/** Something new behind the tab (Up next: shows with a new episode): the sky badge and what a screen reader hears. */
	news?: { badge: string; label: string }
}

/** One chip, or one side of a switch: the same shape. */
export interface NavChoice {
	key: string
	label: string
	href: string
	here: boolean
	count?: number
}

/** A chip row or a switch, with the name screen readers hear. */
export interface NavChoices {
	label: string
	choices: NavChoice[]
}

// Watch ----------------------------------------------------------------------------------------------------

export type WatchTabKey = "up-next" | "ready" | "for-you"
export type WatchChipKey =
	| "next-episodes"
	| "not-started"
	| "watching"
	| "on-hold"
	| "dropped"
	| "tonight"
	| "wishlist"
	| "recent"

/** Where a Watch page sits: its tab, the To watch | Seen side (null on For you), its chip (null on Seen and For you). */
export interface WatchPlace {
	tab: WatchTabKey
	side: "to-watch" | "seen" | null
	chip: WatchChipKey | null
}

const UP_NEXT_CHIPS: [WatchChipKey, string, string][] = [
	["next-episodes", "Next episodes", WATCH_PATHS.nextEpisodes],
	["not-started", "Not started", WATCH_PATHS.notStarted],
	["watching", "Watching", WATCH_PATHS.watching],
	["on-hold", "On hold", WATCH_PATHS.onHold],
	["dropped", "Dropped", WATCH_PATHS.dropped],
]
const READY_CHIPS: [WatchChipKey, string, string][] = [
	["tonight", "Tonight", WATCH_PATHS.tonight],
	["wishlist", "Whole Wishlist", WATCH_PATHS.wishlist],
	["recent", "Recently added", WATCH_PATHS.recent],
]

const trim = (pathname: string) =>
	pathname.length > 1 && pathname.endsWith("/")
		? pathname.slice(0, -1)
		: pathname

/** The Watch page a path names, or null outside Watch (and for an unknown /watch/* slug). */
export function watchPlaceOf(pathname: string): WatchPlace | null {
	const path = trim(pathname)
	if (path === WATCH_PATHS.forYou)
		return { tab: "for-you", side: null, chip: null }
	if (path === WATCH_PATHS.showsSeen)
		return { tab: "up-next", side: "seen", chip: null }
	if (path === WATCH_PATHS.moviesSeen)
		return { tab: "ready", side: "seen", chip: null }
	const show = UP_NEXT_CHIPS.find(([, , href]) => href === path)
	if (show) return { tab: "up-next", side: "to-watch", chip: show[0] }
	const movie = READY_CHIPS.find(([, , href]) => href === path)
	if (movie) return { tab: "ready", side: "to-watch", chip: movie[0] }
	return null
}

/** Watch's three two-line tabs. */
export function watchTabs(pathname: string): AreaTab[] {
	const tab = watchPlaceOf(pathname)?.tab
	return [
		{
			key: "up-next",
			label: "Up next",
			sub: "My shows",
			icon: TvIcon,
			href: WATCH_PATHS.nextEpisodes,
			here: tab === "up-next",
		},
		{
			key: "ready",
			label: "Ready to watch",
			sub: "My movies",
			icon: FilmIcon,
			href: WATCH_PATHS.tonight,
			here: tab === "ready",
		},
		{
			key: "for-you",
			label: "Recommendations",
			sub: "For you",
			icon: SparklesIcon,
			href: WATCH_PATHS.forYou,
			here: tab === "for-you",
		},
	]
}

/** The "To watch | Seen" switch at the top of Up next and Ready to watch; null on For you and outside Watch. */
export function seenSwitch(
	pathname: string,
	seenCount?: number,
): NavChoices | null {
	const place = watchPlaceOf(pathname)
	if (!place || place.side === null) return null
	const shows = place.tab === "up-next"
	return {
		label: shows ? "Your shows" : "Your movies",
		choices: [
			{
				key: "to-watch",
				label: "To watch",
				href: shows ? WATCH_PATHS.nextEpisodes : WATCH_PATHS.tonight,
				here: place.side === "to-watch",
			},
			{
				key: "seen",
				label: "Seen",
				href: shows ? WATCH_PATHS.showsSeen : WATCH_PATHS.moviesSeen,
				here: place.side === "seen",
				count: seenCount,
			},
		],
	}
}

/** The chips under To watch; null on Seen, For you and outside Watch. Leave counts out for guests. */
export function watchChips(
	pathname: string,
	counts: Partial<Record<WatchChipKey, number>> = {},
): NavChoices | null {
	const place = watchPlaceOf(pathname)
	if (!place || place.side !== "to-watch") return null
	const shows = place.tab === "up-next"
	return {
		label: shows ? "Shows to watch" : "Movies to watch",
		choices: (shows ? UP_NEXT_CHIPS : READY_CHIPS).map(
			([key, label, href]) => ({
				key,
				label,
				href,
				here: place.chip === key,
				count: counts[key],
			}),
		),
	}
}

// Explore --------------------------------------------------------------------------------------------------

export type ExploreTabKey =
	| "discover"
	| "new"
	| "hot"
	| "best"
	| "movies"
	| "shows"
	| "people"
	| "map"

const isBest = (path: string) =>
	path === "/movies/best" || path === "/shows/best"

const EXPLORE_TABS: {
	key: ExploreTabKey
	label: string
	href: string
	icon: NavIcon
	here: (path: string) => boolean
}[] = [
	{
		key: "discover",
		label: "Discover",
		href: "/discover",
		icon: MagnifyingGlassIcon,
		here: (p) => under(p, "/discover"),
	},
	{
		key: "new",
		label: "New",
		href: "/new",
		icon: CalendarDaysIcon,
		here: (p) => under(p, "/new"),
	},
	{
		key: "hot",
		label: "Hot",
		href: "/hot-on-socials",
		icon: FireIcon,
		here: (p) => under(p, "/hot-on-socials"),
	},
	{
		key: "best",
		label: "Best",
		href: "/movies/best",
		icon: TrophyIcon,
		here: isBest,
	},
	{
		key: "movies",
		label: "Movies",
		href: "/movies",
		icon: FilmIcon,
		here: (p) => under(p, "/movies") && !isBest(p),
	},
	{
		key: "shows",
		label: "Shows",
		href: "/shows",
		icon: TvIcon,
		here: (p) => under(p, "/shows") && !isBest(p),
	},
	{
		key: "people",
		label: "People",
		href: "/people",
		icon: UserGroupIcon,
		here: (p) => under(p, "/people"),
	},
	{
		key: "map",
		label: "Map",
		href: "/explorer",
		icon: MapIcon,
		here: (p) => under(p, "/explorer"),
	},
]

/** Explore's tabs. `newHref`: `/new` for members, `countryPath(country)` for guests (as the hub did). */
export function exploreTabs(
	pathname: string,
	{ newHref = "/new" }: { newHref?: string } = {},
): AreaTab[] {
	const path = trim(pathname)
	return EXPLORE_TABS.map((t) => ({
		key: t.key,
		label: t.label,
		icon: t.icon,
		href: t.key === "new" ? newHref : t.href,
		here: t.here(path),
	}))
}

/** Best's Movies | Shows switch; null off the Best pages. */
export function bestSwitch(pathname: string): NavChoices | null {
	const path = trim(pathname)
	if (!isBest(path)) return null
	return {
		label: "Best of",
		choices: [
			{
				key: "movies",
				label: "Movies",
				href: "/movies/best",
				here: path === "/movies/best",
			},
			{
				key: "shows",
				label: "Shows",
				href: "/shows/best",
				here: path === "/shows/best",
			},
		],
	}
}

// Profile (key "taste") ------------------------------------------------------------------------------------

/** A Profile tab. "rate" is the extra tab of the row without a profile (/taste, /taste/quiz, the list pages). */
export type TasteTabKey =
	| "profile"
	| "tropes"
	| "scores"
	| "stats"
	| "lists"
	| "seen"
	| "wishlist"
	| "shows"
	| "rate"

type TasteTabDef = { key: TasteTabKey; label: string; icon: NavIcon }

export const OWNER_TASTE_TABS: TasteTabDef[] = [
	{ key: "profile", label: "Taste", icon: FingerPrintIcon },
	{ key: "tropes", label: "Tropes", icon: TagIcon },
	{ key: "scores", label: "Scores", icon: StarIcon },
	{ key: "stats", label: "Stats", icon: ChartBarIcon },
	{ key: "lists", label: "Lists", icon: ListBulletIcon },
]

/** Tabs only visitors get, set apart at the row's end: the owner keeps these in Watch. */
export const VISITOR_TASTE_TABS: TasteTabDef[] = [
	{ key: "seen", label: "Seen", icon: EyeIcon },
	{ key: "wishlist", label: "Wishlist", icon: BookmarkIcon },
	{ key: "shows", label: "Shows", icon: TvIcon },
]

/** How the Profile row is drawn for this page and viewer. */
export interface TasteRow {
	/** The row's name at its start on desktop: "Profile", "As visitors see it", or "@handle". */
	label: string
	/** False for a guest on a profile: no area icon, no lit key. */
	areaIcon: boolean
	/** The profile the row belongs to; null on the rows without one (/taste, /taste/quiz, Settings without a handle). */
	handle: string | null
	/** True when the viewer sees their own profile as visitors do (?as=visitor). */
	asVisitor: boolean
	tabs: AreaTab[]
	/** The visitors-only tabs (Seen · Wishlist · Shows), after a thin divider. */
	trailing: AreaTab[]
	/** The Settings gear at the row's end: members only, never in a visitor's view. */
	gear: { href: string; here: boolean } | null
}

const PROFILE_PATH = /^\/u\/([^/]+)(?:\/([^/]+))?/

/** The Profile tab a profile path lights. */
function profileTabOf(rest: string | undefined): TasteTabKey | null {
	if (!rest) return "profile"
	if (rest === "taste") return "stats"
	return (
		(
			[
				"tropes",
				"scores",
				"stats",
				"lists",
				"seen",
				"wishlist",
				"shows",
			] as const
		).find((t) => t === rest) ?? null
	)
}

export interface TasteRowOptions {
	pathname: string
	search?: string | URLSearchParams
	viewer: PathViewer
	/** Counts after the tab labels (Scores, Lists, Seen, Wishlist, Shows). */
	counts?: Partial<Record<TasteTabKey, number>>
	/** Leave a tab out (a part this viewer may not see). Default: all shown. */
	visible?: (tab: TasteTabKey) => boolean
	/** The owner's lock or members mark on a narrowed part. */
	mark?: (tab: TasteTabKey) => AreaTab["mark"]
}

/**
 * The Profile row for a page in the Profile area, or null outside it. On a profile: the owner's five tabs and the gear;
 * visitors (and the owner with ?as=visitor) get the five plus Seen · Wishlist · Shows and no gear, every link keeping
 * ?as=visitor. Without a profile (/taste, /taste/quiz, list pages and Settings for guests and members without a
 * handle): Taste → /taste, Rate more → /taste/quiz and Lists (/lists/mine for members, /lists/new for guests), plus the
 * gear for members.
 */
export function tasteRow({
	pathname,
	search,
	viewer,
	counts = {},
	visible = () => true,
	mark,
}: TasteRowOptions): TasteRow | null {
	const path = trim(pathname)
	if (areaOf(path) !== "taste") return null
	const own = handleOf(viewer)
	const member = viewer.kind === "member"
	const inSettings = under(path, SETTINGS_PATHS.home)
	const gearOf = (show: boolean) =>
		show && member ? { href: SETTINGS_PATHS.home, here: inSettings } : null

	const profile = PROFILE_PATH.exec(path)
	const handle = profile ? decodeURIComponent(profile[1]) : own
	const here: TasteTabKey | null = profile
		? profileTabOf(profile[2])
		: under(path, "/lists")
			? "lists"
			: under(path, RATE_FALLBACK_PATH)
				? handle
					? "scores"
					: "rate"
				: path === TASTE_FALLBACK_PATH
					? "profile"
					: null

	if (!handle) {
		const tabs: AreaTab[] = [
			{
				key: "profile",
				label: "Taste",
				icon: FingerPrintIcon,
				href: TASTE_FALLBACK_PATH,
				here: here === "profile",
			},
			{
				key: "rate",
				label: "Rate more",
				icon: StarIcon,
				href: RATE_FALLBACK_PATH,
				here: here === "rate",
			},
			{
				key: "lists",
				label: "Lists",
				icon: ListBulletIcon,
				href: member ? "/lists/mine" : "/lists/new",
				here: here === "lists",
			},
		]
		return {
			label: "Profile",
			areaIcon: true,
			handle: null,
			asVisitor: false,
			tabs,
			trailing: [],
			gear: gearOf(true),
		}
	}

	const isOwner = own != null && own.toLowerCase() === handle.toLowerCase()
	const asVisitor =
		isOwner && new URLSearchParams(search).get("as") === "visitor"
	const visitorView = !isOwner || asVisitor
	const query = asVisitor ? { as: "visitor" } : undefined
	const tab = (t: TasteTabDef): AreaTab => ({
		key: t.key,
		label: t.label,
		icon: t.icon,
		href: tastePath(handle, t.key as Exclude<TasteTabKey, "rate">, query),
		here: !inSettings && here === t.key,
		count: counts[t.key],
		mark: isOwner ? mark?.(t.key) : undefined,
	})
	const tabs = OWNER_TASTE_TABS.filter((t) => visible(t.key)).map(tab)
	if (!visitorView)
		return {
			label: "Profile",
			areaIcon: true,
			handle,
			asVisitor: false,
			tabs,
			trailing: [],
			gear: gearOf(true),
		}
	return {
		label: asVisitor ? "As visitors see it" : `@${handle}`,
		areaIcon: viewer.kind === "member",
		handle,
		asVisitor,
		tabs,
		trailing: VISITOR_TASTE_TABS.filter((t) => visible(t.key)).map(tab),
		gear: null,
	}
}

/** Scores' "Scored | Not rated" switch, for the owner on /u/:h/scores and /scores/not-rated; null elsewhere. */
export function scoresSwitch(
	handle: string,
	pathname: string,
	counts: { scored?: number; notRated?: number } = {},
): NavChoices | null {
	const path = trim(pathname)
	const scored = tastePath(handle, "scores")
	const notRated = tastePath(handle, "not-rated")
	const lower = path.toLowerCase()
	if (lower !== scored.toLowerCase() && lower !== notRated.toLowerCase())
		return null
	const onNotRated = lower === notRated.toLowerCase()
	return {
		label: "Your scores",
		choices: [
			{
				key: "scored",
				label: "Scored",
				href: scored,
				here: !onNotRated,
				count: counts.scored,
			},
			{
				key: "not-rated",
				label: "Not rated",
				href: notRated,
				here: onNotRated,
				count: counts.notRated,
			},
		],
	}
}

// ---------------------------------------------------------------------------------------------------------
// Places: the account menu and the Settings column

/** Discord's mark (the footer's, drawn here without JSX so this module stays plain TypeScript). */
export const DiscordMark: NavIcon = ({ className, ...props }) =>
	createElement(
		"svg",
		{
			"aria-hidden": "true",
			viewBox: "0 0 127.14 96.36",
			className: `fill-current ${className ?? ""}`,
			...props,
		},
		createElement("path", {
			d: "M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c1.24-23.28-3.28-47.54-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.25-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z",
		}),
	)

export interface Place {
	id: string
	label: string
	icon: NavIcon
	/** Where the row leads. Absent for a row that acts instead (Feedback). */
	href?: string
	/** Feedback opens the Feedback tab (`openFeedback` in ui/feedback/FeedbackTab.tsx) instead of navigating. */
	action?: "feedback"
	/** A small tag after the label ("Soon"). */
	tag?: string
	/** The count after the label, read by the caller: Not interested's number of titles. */
	count?: "not-interested"
}

/** Settings rows, most used first. */
export const SETTINGS_PLACES: Place[] = [
	{
		id: "services",
		label: "Streaming services",
		icon: TvIcon,
		href: SETTINGS_PATHS.services,
	},
	{
		id: "country",
		label: "Watching from",
		icon: GlobeEuropeAfricaIcon,
		href: SETTINGS_PATHS.country,
	},
	{
		id: "language",
		label: "Show titles in",
		icon: LanguageIcon,
		href: SETTINGS_PATHS.language,
	},
	{
		id: "account",
		label: "Account",
		icon: KeyIcon,
		href: SETTINGS_PATHS.account,
	},
	{
		id: "connected-apps",
		label: "Connected apps",
		icon: PuzzlePieceIcon,
		href: SETTINGS_PATHS.connectedApps,
	},
	{
		id: "privacy",
		label: "Privacy",
		icon: ShieldCheckIcon,
		href: SETTINGS_PATHS.privacy,
	},
]

export const ALL_SETTINGS: Place = {
	id: "settings",
	label: "All settings",
	icon: Cog6ToothIcon,
	href: SETTINGS_PATHS.home,
}

export const EDIT_PROFILE: Place = {
	id: "profile",
	label: "Edit profile",
	icon: PencilSquareIcon,
	href: SETTINGS_PATHS.profile,
}

/** Your data: the tools you rarely open. Their pages live under Settings. */
export const DATA_PLACES: Place[] = [
	{
		id: "imports",
		label: "Import",
		icon: ArrowDownTrayIcon,
		href: SETTINGS_PATHS.imports,
	},
	{
		id: "not-interested",
		label: "Not interested",
		icon: NoSymbolIcon,
		href: SETTINGS_PATHS.notInterested,
		count: "not-interested",
	},
	{
		id: "export",
		label: "Export",
		icon: ArrowUpTrayIcon,
		href: SETTINGS_PATHS.export,
		tag: "Soon",
	},
]

/** GoodWatch elsewhere: two rows, each with its own mark. */
export const APP_PLACES: Place[] = [
	{
		id: "use-with-ai",
		label: "Use with AI",
		icon: SparklesIcon,
		href: "/use-with-ai",
	},
	// DISCORD_BOT_PATH (ui/discord-bot/links.ts).
	{
		id: "discord-bot",
		label: "Discord bot",
		icon: DiscordMark,
		href: "/discord",
	},
]

/** Help: drawn two by two in the menu. */
export const HELP_PLACES: Place[] = [
	{
		id: "feedback",
		label: "Feedback",
		icon: ChatBubbleLeftEllipsisIcon,
		action: "feedback",
	},
	{ id: "support", label: "Support", icon: LifebuoyIcon, href: "/support" },
	{
		id: "how-it-works",
		label: "How it works",
		icon: QuestionMarkCircleIcon,
		href: "/how-it-works",
	},
	{ id: "about", label: "About", icon: InformationCircleIcon, href: "/about" },
]

export interface PlaceGroup {
	/** The group's small uppercase name; null for the identity rows at the top of the menu. */
	name: string | null
	places: Place[]
	/** Drawn two by two (Help). */
	grid?: boolean
}

/**
 * Every place, grouped as the account menu shows them. Desktop: two columns, `left` (identity rows: View as visitor and
 * Share profile come before Edit profile and are drawn by the menu itself, then Your data) and `right` (Settings, Use
 * GoodWatch elsewhere, Help), with Sign out under the right column. Phone: `left` then `right` in one column.
 */
export const PLACES: { left: PlaceGroup[]; right: PlaceGroup[] } = {
	left: [
		{ name: null, places: [EDIT_PROFILE] },
		{ name: "Your data", places: DATA_PLACES },
	],
	right: [
		{ name: "Settings", places: [...SETTINGS_PLACES, ALL_SETTINGS] },
		{ name: "Use GoodWatch elsewhere", places: APP_PLACES },
		{ name: "Help", places: HELP_PLACES, grid: true },
	],
}

/** The Settings column (desktop) and chip row (phone): All settings, Edit profile, the settings rows, then Your data. */
export const SETTINGS_COLUMN: PlaceGroup[] = [
	{
		name: "Settings",
		places: [ALL_SETTINGS, EDIT_PROFILE, ...SETTINGS_PLACES],
	},
	{ name: "Your data", places: DATA_PLACES },
]

/** True when the place is the page at `pathname`: All settings on /settings only, the others on their page and below. */
export function placeHere(place: Place, pathname: string): boolean {
	if (!place.href) return false
	const path = trim(pathname)
	return place.href === SETTINGS_PATHS.home
		? path === place.href
		: under(path, place.href)
}
