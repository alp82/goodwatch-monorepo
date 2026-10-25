// Every page the command palette can go to, and how typed text finds them. Opened empty, the palette shows only the
// essentials (ESSENTIALS); typing searches the whole list, next to the title search.
//
// To add a page, add one line to PAGES with `page(...)`. To also show it on the empty palette, put its key in
// ESSENTIALS. `label` is the name people read; `names` are other names that count as typing its name exactly;
// `words` are synonyms and related words that find it. The section a page sits in (`sub`) is searchable too, so
// "settings" finds every Settings page.
import {
	AdjustmentsHorizontalIcon,
	ArrowDownTrayIcon,
	ArrowRightEndOnRectangleIcon,
	BookmarkIcon,
	CalendarDaysIcon,
	ChartBarIcon,
	ChatBubbleLeftEllipsisIcon,
	Cog6ToothIcon,
	CpuChipIcon,
	DocumentTextIcon,
	EyeIcon,
	EyeSlashIcon,
	FaceSmileIcon,
	FilmIcon,
	FingerPrintIcon,
	FireIcon,
	GlobeAltIcon,
	HomeIcon,
	InformationCircleIcon,
	KeyIcon,
	LanguageIcon,
	LifebuoyIcon,
	LightBulbIcon,
	LinkIcon,
	ListBulletIcon,
	LockClosedIcon,
	MagnifyingGlassIcon,
	MapIcon,
	NewspaperIcon,
	PauseCircleIcon,
	PlayIcon,
	PlusCircleIcon,
	QuestionMarkCircleIcon,
	ScaleIcon,
	ShieldCheckIcon,
	SignalIcon,
	SparklesIcon,
	Squares2X2Icon,
	StarIcon,
	TagIcon,
	TrophyIcon,
	TvIcon,
	UserCircleIcon,
	UserGroupIcon,
	XCircleIcon,
} from "@heroicons/react/24/solid"
import type { ComponentType, SVGProps } from "react"
import { LIBRARY_HUB, SCORES_PAGE, statusPage } from "~/domain/my-library"
import { CONNECTED_APPS_PATH } from "~/ui/connector/connector"
import { DISCORD_BOT_PATH } from "~/ui/discord-bot/links"
import type { PageData } from "~/ui/explore/config"
import { mainHierarchy } from "~/ui/explore/main-nav"
import { IMPORTS_PATH } from "~/ui/imports/shared"
import {
	ACCOUNT_PATH,
	COUNTRY_PATH,
	DISCOVER_PRIVACY_PATH,
	HIDDEN_PATH,
	PROFILE_PATH,
	SERVICES_PATH,
	SETTINGS_PATH,
	TITLE_LANGUAGE_PATH,
} from "~/ui/settings/paths"
import { myListsPath, newListPath, profilePath } from "~/ui/share-card/links"
import type { DestinationKey } from "./destinations"

type Icon = ComponentType<SVGProps<SVGSVGElement>>
/** A heroicon, or "discord" for the Discord mark (footer/links.tsx), which the palette draws. */
export type PageIcon = Icon | "discord"

/** Who is looking: a member (with or without a profile handle yet) or a visitor. */
export interface PaletteViewer {
	member: boolean
	/** The member's profile handle; null before they pick one. */
	handle: string | null
	/** Where Sign up goes (it comes back to the page). */
	signUpHref: string
}

export interface PalettePage {
	key: string
	/** The name on the row. */
	label: string
	/** The section the page sits in, under the name in search results ("Settings", "My library"). */
	sub?: string
	href: string
	icon: PageIcon
	/** Other names: typing one of them counts as typing the page's name. */
	names?: string[]
	/** Synonyms and related words that find the page. */
	words?: string[]
	/** Only for members or only for visitors; left out for everyone. */
	for?: "member" | "visitor"
	/** The site destination the page is, for "You're here" and the up-next line. */
	destination?: DestinationKey
	/** Runs in place of following `href`; `href` is where it goes when the action isn't available. */
	action?: "feedback"
	/** A call to action (Sign up): a full row with its line, not a compact "Go to" row. */
	cta?: boolean
}

type PageInput = Omit<PalettePage, "key" | "label" | "href" | "icon">
type Entry = PalettePage | ((viewer: PaletteViewer) => PalettePage | null)

const page = (
	key: string,
	label: string,
	href: string,
	icon: PageIcon,
	more: PageInput = {},
): PalettePage => ({ key, label, href, icon, ...more })

const LIBRARY = "My library"
const PROFILE = "Your profile"
const SETTINGS = "Settings"
const DISCOVER = "Discover"
const GOODWATCH = "GoodWatch"
const LEGAL = "Legal"

/** A profile tab: only once the member has a handle, since the profile lives at it. */
const profileTab =
	(tab: string, label: string, icon: Icon, words: string[]) =>
	({ member, handle }: PaletteViewer): PalettePage | null =>
		member && handle
			? page(`profile-${tab}`, label, `${profilePath(handle)}/${tab}`, icon, {
					sub: PROFILE,
					words,
				})
			: null

const CATEGORY_HUB: Record<
	string,
	{ movies: string; shows: string; icon: Icon; words: string[] }
> = {
	moods: {
		movies: "Movies by mood",
		shows: "Shows by mood",
		icon: FaceSmileIcon,
		words: ["moods", "feeling", "vibe"],
	},
	genres: {
		movies: "Movies by genre",
		shows: "Shows by genre",
		icon: Squares2X2Icon,
		words: ["genres", "categories"],
	},
	streaming: {
		movies: "Movies by service",
		shows: "Shows by service",
		icon: SignalIcon,
		words: ["streaming", "services", "providers"],
	},
}

/** A list's name without its emoji ("Scary 👻" → "Scary"). */
const plainLabel = (label: string) =>
	label
		.replace(/[^\p{L}\p{N}&+'’ -]/gu, "")
		.replace(/\s+/g, " ")
		.trim()

/** "Horror movies", "Netflix shows"; a name that already says what it lists stays as it is ("Talk Shows"). */
const listName = (label: string, type: "movies" | "shows") =>
	/\b(movies?|shows?)$/i.test(label) ? label : `${label} ${type}`

/** The category hubs and their lists, as in the sitemap: a list belongs to movies, shows, or both. */
function browsePages(): PalettePage[] {
	const pages: PalettePage[] = []
	for (const type of ["movies", "shows"] as const) {
		for (const [category, lists] of Object.entries(mainHierarchy) as [
			string,
			Record<string, PageData>,
		][]) {
			const hub = CATEGORY_HUB[category]
			if (!hub) continue
			pages.push(
				page(
					`${type}-${category}`,
					hub[type],
					`/${type}/${category}`,
					hub.icon,
					{
						sub: type === "movies" ? "Movies" : "Shows",
						words: hub.words,
					},
				),
			)
			for (const list of Object.values(lists)) {
				if (list.type !== "all" && list.type !== type) continue
				const name = plainLabel(list.label)
				pages.push(
					page(
						`${type}-${category}-${list.path}`,
						listName(name, type),
						`/${type}/${category}/${list.path}`,
						hub.icon,
						{
							sub: hub[type],
							// The bare name is a synonym, not the page's name: typing "horror" still leaves Enter on
							// "Search Discover", which finds horror of every kind.
							words: [name, list.subtitle],
						},
					),
				)
			}
		}
	}
	return pages
}

/**
 * The pages, in the order ties are broken: the site's main places first, then your own pages, the app and the
 * company pages, Discover's presets, and the lists by mood, genre and service last.
 */
const PAGES: Entry[] = [
	// The main places (destinations.ts).
	page("home", "Home", "/", HomeIcon, {
		destination: "home",
		words: ["start", "front page", "landing"],
	}),
	page("watchNext", "Watch next", "/watch-next", PlayIcon, {
		destination: "watchNext",
		for: "visitor",
		words: ["tonight", "pick", "wishlist", "up next"],
	}),
	page("myShows", "My shows", "/my-shows", TvIcon, {
		destination: "myShows",
		for: "member",
		words: [
			"tv",
			"series",
			"watching",
			"episodes",
			"tracking",
			"continue",
			"up next",
			"watch next",
		],
	}),
	page("myMovies", "My movies", "/my-movies", FilmIcon, {
		destination: "myMovies",
		for: "member",
		words: ["films", "watch next", "want to see", "tonight", "pick"],
	}),
	page("forYou", "For you", "/for-you", SparklesIcon, {
		destination: "forYou",
		words: [
			"recommendations",
			"recommended",
			"suggestions",
			"picks",
			"personal",
		],
	}),
	page("discover", "Discover", "/discover", MagnifyingGlassIcon, {
		destination: "discover",
		words: ["search", "filter", "browse", "find"],
	}),
	page("taste", "Taste", "/taste", FingerPrintIcon, {
		destination: "taste",
		words: [
			"viewer type",
			"fingerprint",
			"preferences",
			"dna",
			"taste profile",
		],
	}),
	page("explorer", "Explorer", "/explorer", MapIcon, {
		destination: "explorer",
		words: ["map", "related", "similar", "graph"],
	}),
	page("movies", "Movies", "/movies", FilmIcon, {
		destination: "movies",
		words: ["films", "cinema"],
	}),
	page("shows", "Shows", "/shows", TvIcon, {
		destination: "shows",
		names: ["tv shows"],
		words: ["tv", "series"],
	}),
	page("hot", "Hot on socials", "/hot-on-socials", FireIcon, {
		destination: "hot",
		words: [
			"trending",
			"buzz",
			"viral",
			"popular",
			"social media",
			"tiktok",
			"reddit",
		],
	}),
	// What arrived on streaming in the last 14 days (#489): a member's own services; a visitor's country.
	(viewer) =>
		page(
			"new",
			viewer.member ? "New on your services" : "New on streaming",
			"/new",
			CalendarDaysIcon,
			{
				destination: "new",
				names: ["new", "new on streaming", "new on your services"],
				words: ["just added", "new arrivals", "recently added", "arrived"],
			},
		),
	page("bestMovies", "Best movies", "/movies/best", TrophyIcon, {
		words: ["top movies", "best films", "top rated", "ranking", "greatest"],
	}),
	page("bestShows", "Best TV shows", "/shows/best", TrophyIcon, {
		names: ["best shows"],
		words: ["top shows", "best series", "top rated", "ranking", "greatest"],
	}),
	page("people", "People", "/people", UserGroupIcon, {
		words: ["actors", "actresses", "cast", "directors", "stars", "celebrities"],
	}),

	// Taste.
	page("tasteQuiz", "Taste quiz", "/taste/quiz", FingerPrintIcon, {
		sub: "Taste",
		words: ["quiz", "rate titles", "start", "onboarding"],
	}),
	page(
		"tasteFingerprint",
		"What pulls you",
		"/taste#fingerprint",
		FingerPrintIcon,
		{
			sub: "Taste",
			for: "member",
			words: ["fingerprint", "taste fingerprint"],
		},
	),
	page(
		"tasteEveryone",
		"Your taste vs everyone",
		"/taste#everyone",
		UserGroupIcon,
		{
			sub: "Taste",
			for: "member",
			names: ["vs everyone"],
			words: ["compare", "crowd", "everyone"],
		},
	),

	// My library: the member's marked titles.
	page("myLibrary", "My library", LIBRARY_HUB, BookmarkIcon, {
		destination: "myLibrary",
		for: "member",
		words: ["library", "collection", "saved", "marked"],
	}),
	page("wishlist", "Wishlist", statusPage({ status: "want" }), BookmarkIcon, {
		sub: LIBRARY,
		for: "member",
		names: ["want to see"],
		words: ["watchlist", "watch later", "saved", "bookmarks"],
	}),
	page("seen", "Seen", statusPage({ status: "seen" }), EyeIcon, {
		sub: LIBRARY,
		for: "member",
		words: ["watched", "history", "already seen"],
	}),
	page("myScores", "My scores", SCORES_PAGE, StarIcon, {
		sub: LIBRARY,
		for: "member",
		names: ["scores"],
		words: ["ratings", "rated", "rescore"],
	}),
	page("watching", "Watching", statusPage({ status: "watching" }), PlayIcon, {
		sub: LIBRARY,
		for: "member",
		words: ["in progress", "started", "currently watching"],
	}),
	page(
		"onHold",
		"On hold",
		statusPage({ status: "on_hold" }),
		PauseCircleIcon,
		{
			sub: LIBRARY,
			for: "member",
			words: ["paused"],
		},
	),
	page("dropped", "Dropped", statusPage({ status: "dropped" }), XCircleIcon, {
		sub: LIBRARY,
		for: "member",
		words: ["abandoned", "stopped", "gave up"],
	}),
	page(
		"notRated",
		"Not rated",
		statusPage({ status: "unrated" }),
		QuestionMarkCircleIcon,
		{
			sub: LIBRARY,
			for: "member",
			names: ["unrated"],
			words: ["rate", "no score"],
		},
	),
	page("hidden", "Hidden titles", HIDDEN_PATH, EyeSlashIcon, {
		sub: LIBRARY,
		for: "member",
		names: ["not interested"],
		words: ["hidden", "blocked", "hide"],
	}),

	// Lists.
	page("myLists", "Your lists", myListsPath, ListBulletIcon, {
		sub: "Lists",
		for: "member",
		names: ["lists", "my lists"],
		words: ["share list", "top 5"],
	}),
	page("newList", "Make your top 5", newListPath(), PlusCircleIcon, {
		sub: "Lists",
		names: ["top 5", "top five"],
		words: ["new list", "share", "list", "favorites"],
	}),

	// The member's public profile.
	({ member, handle }) =>
		member
			? handle
				? page("profile", "Your profile", profilePath(handle), UserCircleIcon, {
						names: ["profile"],
						words: ["public profile", "me", "my page", handle],
					})
				: page("profile", "Your profile", PROFILE_PATH, UserCircleIcon, {
						sub: "Pick a handle first",
						names: ["profile"],
						words: ["handle", "pick a handle", "public profile", "me"],
					})
			: null,
	profileTab("stats", "Stats", ChartBarIcon, [
		"statistics",
		"numbers",
		"taste stats",
		"charts",
	]),
	profileTab("tropes", "Tropes", TagIcon, ["tv tropes", "patterns", "themes"]),
	profileTab("wishlist", "Profile wishlist", BookmarkIcon, [
		"public wishlist",
		"want to see",
	]),
	profileTab("seen", "Profile seen", EyeIcon, ["public seen", "watched"]),
	profileTab("scores", "Profile scores", StarIcon, [
		"public scores",
		"ratings",
	]),
	profileTab("shows", "Profile shows", TvIcon, ["public shows", "series"]),
	profileTab("lists", "Profile lists", ListBulletIcon, ["public lists"]),

	// Settings: members only (the layout sends visitors to sign in).
	page("settings", "Settings", SETTINGS_PATH, Cog6ToothIcon, {
		for: "member",
		names: ["preferences", "options"],
		words: ["config", "account", "setup"],
	}),
	page("country", "Watching from", COUNTRY_PATH, GlobeAltIcon, {
		sub: SETTINGS,
		for: "member",
		names: ["country"],
		words: ["region", "location", "where"],
	}),
	page("services", "Your services", SERVICES_PATH, TvIcon, {
		sub: SETTINGS,
		for: "member",
		names: ["services", "streaming services", "my services"],
		words: [
			"providers",
			"subscriptions",
			"netflix",
			"prime",
			"disney",
			"hbo",
			"streaming",
		],
	}),
	page("language", "Show titles in", TITLE_LANGUAGE_PATH, LanguageIcon, {
		sub: SETTINGS,
		for: "member",
		names: ["language"],
		words: ["translation", "locale", "title language"],
	}),
	page(
		"privacy-settings",
		"Discover and privacy",
		DISCOVER_PRIVACY_PATH,
		LockClosedIcon,
		{
			sub: SETTINGS,
			for: "member",
			words: ["privacy", "public", "private", "visibility"],
		},
	),
	page("editProfile", "Edit profile", PROFILE_PATH, UserCircleIcon, {
		sub: SETTINGS,
		for: "member",
		words: ["handle", "avatar", "photo", "name", "bio", "profile"],
	}),
	page("account", "Account and sign-in", ACCOUNT_PATH, ShieldCheckIcon, {
		sub: SETTINGS,
		for: "member",
		names: ["account"],
		words: [
			"email",
			"password",
			"sign in",
			"login",
			"security",
			"delete account",
		],
	}),
	page("imports", "Imports", IMPORTS_PATH, ArrowDownTrayIcon, {
		sub: SETTINGS,
		for: "member",
		names: ["import"],
		words: [
			"letterboxd",
			"imdb",
			"trakt",
			"netflix",
			"plex",
			"mdblist",
			"csv",
			"upload",
			"sync",
			"bring",
		],
	}),
	page("connectedApps", "Connected apps", CONNECTED_APPS_PATH, LinkIcon, {
		sub: SETTINGS,
		for: "member",
		words: ["mcp", "ai", "claude", "chatgpt", "apps", "assistants", "oauth"],
	}),

	// Signing in.
	({ member, signUpHref }) =>
		member
			? null
			: page("signUp", "Sign up", signUpHref, ArrowRightEndOnRectangleIcon, {
					sub: "Keep your Wishlist and let Best match learn your taste",
					names: ["register"],
					words: ["create account", "join", "account"],
					cta: true,
				}),
	page("signIn", "Sign in", "/sign-in", ArrowRightEndOnRectangleIcon, {
		for: "visitor",
		names: ["log in", "login"],
		// What a visitor reaches only after signing in.
		words: ["account", "settings", "my library", "profile", "imports", "lists"],
	}),
	page("forgotPassword", "Forgot password", "/forgot-password", KeyIcon, {
		for: "visitor",
		words: ["reset password", "password"],
	}),

	// The app and the company.
	page("useWithAi", "Use with AI", "/use-with-ai", CpuChipIcon, {
		sub: GOODWATCH,
		words: ["ai", "mcp", "claude", "chatgpt", "assistant", "connect", "chat"],
	}),
	page("discordBot", "Discord bot", DISCORD_BOT_PATH, "discord", {
		sub: GOODWATCH,
		names: ["discord"],
		words: ["bot", "server", "community"],
	}),
	page("feedback", "Send feedback", "/support", ChatBubbleLeftEllipsisIcon, {
		sub: "Bug, idea, or something to fix on this page",
		names: ["feedback"],
		words: ["bug", "idea", "report", "suggest", "fix", "problem", "wrong"],
		action: "feedback",
	}),
	page("support", "Support", "/support", LifebuoyIcon, {
		sub: GOODWATCH,
		names: ["help"],
		words: ["contact", "bug", "problem", "email", "broken"],
	}),
	page("about", "About", "/about", InformationCircleIcon, {
		sub: GOODWATCH,
		names: ["about goodwatch", "about us"],
		words: ["who", "story", "why"],
	}),
	page("howItWorks", "How it works", "/how-it-works", LightBulbIcon, {
		sub: GOODWATCH,
		words: ["scores", "methodology", "faq", "ratings", "sources", "explained"],
	}),
	page("blog", "Blog", "/blog", NewspaperIcon, {
		sub: GOODWATCH,
		words: ["articles", "posts", "news", "studies", "data study"],
	}),
	page("disclaimer", "Disclaimer", "/disclaimer", ScaleIcon, {
		sub: LEGAL,
		words: ["legal", "imprint"],
	}),
	page("privacy", "Privacy policy", "/privacy", LockClosedIcon, {
		sub: LEGAL,
		names: ["privacy"],
		words: ["legal", "data", "gdpr", "cookies"],
	}),
	page("terms", "Terms of service", "/terms", DocumentTextIcon, {
		sub: LEGAL,
		names: ["terms", "tos"],
		words: ["legal"],
	}),

	// Discover with a filter or an order set.
	page(
		"discoverMovies",
		"Discover movies",
		"/discover?type=movie",
		AdjustmentsHorizontalIcon,
		{
			sub: DISCOVER,
			words: ["films", "movies only"],
		},
	),
	page(
		"discoverShows",
		"Discover shows",
		"/discover?type=show",
		AdjustmentsHorizontalIcon,
		{
			sub: DISCOVER,
			words: ["tv", "series", "shows only"],
		},
	),
	page(
		"discoverAnime",
		"Discover anime",
		"/discover?anime=only",
		AdjustmentsHorizontalIcon,
		{
			sub: DISCOVER,
			names: ["anime"],
			words: ["japanese animation"],
		},
	),
	page(
		"discoverTop",
		"Top rated",
		"/discover?sort=top",
		AdjustmentsHorizontalIcon,
		{
			sub: DISCOVER,
			words: ["best", "highest score", "top"],
		},
	),
	page(
		"discoverNewest",
		"Newest releases",
		"/discover?sort=newest",
		AdjustmentsHorizontalIcon,
		{
			sub: DISCOVER,
			words: ["new", "latest", "recent", "fresh"],
		},
	),
	page(
		"discoverMatch",
		"Best match",
		"/discover?sort=match",
		AdjustmentsHorizontalIcon,
		{
			sub: DISCOVER,
			words: ["match", "for me", "my taste"],
		},
	),
	page(
		"discoverMine",
		"On my services",
		"/discover?services=mine",
		AdjustmentsHorizontalIcon,
		{
			sub: DISCOVER,
			for: "member",
			words: ["streaming", "available", "my services", "can watch"],
		},
	),

	// The lists by mood, genre and service, for movies and for shows.
	...browsePages(),
]

/** What the empty palette shows, in this order. Visitors also get Sign up last. */
export const ESSENTIALS: Record<"member" | "visitor", string[]> = {
	member: [
		"myShows",
		"myMovies",
		"forYou",
		"new",
		"discover",
		"taste",
		"myLibrary",
		"settings",
	],
	visitor: [
		"watchNext",
		"forYou",
		"discover",
		"hot",
		"movies",
		"shows",
		"signUp",
	],
}

/** Every page the viewer can go to, in tie-break order. */
export function palettePages(viewer: PaletteViewer): PalettePage[] {
	const pages: PalettePage[] = []
	for (const entry of PAGES) {
		const p = typeof entry === "function" ? entry(viewer) : entry
		if (!p) continue
		if (p.for === "member" && !viewer.member) continue
		if (p.for === "visitor" && viewer.member) continue
		pages.push(p)
	}
	return pages
}

/** The empty palette's rows: the viewer's essentials, in their order. */
export function essentialPages(
	pages: PalettePage[],
	viewer: Pick<PaletteViewer, "member">,
): PalettePage[] {
	const byKey = new Map(pages.map((p) => [p.key, p]))
	return ESSENTIALS[viewer.member ? "member" : "visitor"].flatMap(
		(key) => byKey.get(key) ?? [],
	)
}

/** The hint on the empty palette: how much typing reaches, rounded down to tens. */
export function typeHint(pageCount: number): string {
	const shown =
		pageCount >= 20 ? `${Math.floor(pageCount / 10) * 10}+` : String(pageCount)
	return `Type to search ${shown} pages, plus every title and person`
}

// ---------------------------------------------------------------------------------------------------------
// Matching

/** Lowercase, without accents or punctuation, "&" read as "and", single spaces. */
export function normalize(text: string): string {
	return text
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/['’]/g, "")
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim()
}

/** How well a page matches, best first. */
export const SCORE = {
	/** The page's name or one of its other names, exactly. */
	name: 1000,
	/** A synonym, exactly. */
	word: 900,
	/** The start of its name. */
	namePrefix: 800,
	/** The section it sits in, exactly ("settings"). */
	section: 700,
	/** The start of a synonym. */
	wordPrefix: 600,
	/** Every typed word starts a word of its name. */
	nameWords: 550,
	/** Every typed word starts a word of its name, synonyms or section. */
	anyWords: 450,
	/** The text inside its name. */
	inside: 300,
	/** A typo away from a word it has (one letter wrong, missing, extra, or two swapped). */
	typo: 200,
} as const

interface Prepared {
	page: PalettePage
	names: string[]
	words: string[]
	section: string
	nameTokens: string[]
	allTokens: string[]
}

const tokens = (texts: string[]) =>
	texts.flatMap((t) => t.split(" ")).filter(Boolean)

function prepare(p: PalettePage): Prepared {
	const names = [p.label, ...(p.names ?? [])].map(normalize)
	const words = (p.words ?? []).map(normalize)
	const section = p.cta || p.action ? "" : normalize(p.sub ?? "")
	const nameTokens = tokens(names)
	return {
		page: p,
		names,
		words,
		section,
		nameTokens,
		allTokens: [...nameTokens, ...tokens(words), ...tokens([section])],
	}
}

/** Whether `a` and `b` are at most one edit apart, counting two swapped letters as one. */
export function oneEditApart(a: string, b: string): boolean {
	if (a === b) return true
	if (Math.abs(a.length - b.length) > 1) return false
	let i = 0
	while (i < a.length && i < b.length && a[i] === b[i]) i++
	if (a.length === b.length) {
		if (a.slice(i + 1) === b.slice(i + 1)) return true
		return (
			a[i] === b[i + 1] &&
			a[i + 1] === b[i] &&
			a.slice(i + 2) === b.slice(i + 2)
		)
	}
	const [short, long] = a.length < b.length ? [a, b] : [b, a]
	return short.slice(i) === long.slice(i + 1)
}

function scoreOf(prepared: Prepared, q: string, typed: string[]): number {
	const { names, words, section, nameTokens, allTokens } = prepared
	if (names.includes(q)) return SCORE.name
	if (words.includes(q)) return SCORE.word
	if (names.some((n) => n.startsWith(q))) return SCORE.namePrefix
	if (section && section === q) return SCORE.section
	if (words.some((w) => w.startsWith(q))) return SCORE.wordPrefix
	const starts = (list: string[]) =>
		typed.every((t) => list.some((w) => w.startsWith(t)))
	if (starts(nameTokens)) return SCORE.nameWords
	if (starts(allTokens)) return SCORE.anyWords
	if (q.length >= 3 && names.some((n) => n.includes(q))) return SCORE.inside
	// Typos only in longer words: short ones are a letter away from too much.
	const near = typed.every((t) =>
		t.length >= 4
			? allTokens.some(
					(w) => w.length >= 4 && (w.startsWith(t) || oneEditApart(t, w)),
				)
			: allTokens.some((w) => w.startsWith(t)),
	)
	if (near && typed.some((t) => t.length >= 4)) return SCORE.typo
	return 0
}

export interface PageMatch {
	page: PalettePage
	score: number
}

/** The pages that match the typed text, best first; ties keep the list's order. */
export function matchPages(pages: PalettePage[], query: string): PageMatch[] {
	const q = normalize(query)
	if (!q) return []
	const typed = q.split(" ")
	const matches: (PageMatch & { index: number })[] = []
	pages.forEach((p, index) => {
		const score = scoreOf(prepare(p), q, typed)
		if (score > 0) matches.push({ page: p, score, index })
	})
	matches.sort((a, b) => b.score - a.score || a.index - b.index)
	return matches.map(({ page, score }) => ({ page, score }))
}

/** How many page rows typing shows at most, and how they sit around the title results. */
export const PAGE_ROWS = {
	/** Pages named exactly: above "Search Discover", so Enter goes there. */
	first: 2,
	/** Strong matches: under "Search Discover", above the titles. */
	beforeTitles: 6,
	/** Weaker matches: under the titles. */
	afterTitles: 4,
} as const

export interface PlacedPages {
	first: PalettePage[]
	beforeTitles: PalettePage[]
	afterTitles: PalettePage[]
}

/** Where each matching page goes in the typed palette. */
export function placePages(matches: PageMatch[]): PlacedPages {
	const first = matches
		.filter((m) => m.score >= SCORE.name)
		.slice(0, PAGE_ROWS.first)
	const rest = matches.filter((m) => !first.includes(m))
	const beforeTitles = rest
		.filter((m) => m.score >= SCORE.anyWords)
		.slice(0, PAGE_ROWS.beforeTitles)
	const afterTitles = rest
		.filter((m) => !beforeTitles.includes(m))
		.slice(0, PAGE_ROWS.afterTitles)
	return {
		first: first.map((m) => m.page),
		beforeTitles: beforeTitles.map((m) => m.page),
		afterTitles: afterTitles.map((m) => m.page),
	}
}
