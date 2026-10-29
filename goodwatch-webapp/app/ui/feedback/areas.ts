// Every page type of the webapp and the parts of it a reader can report on: what fix mode lists, outlines and asks.
// docs/design/feedback-areas.md is the same table for people; change both together.
//
// Members may correct cast and crew, dates, episode titles, and a wrong or missing streaming service ("fix").
// Everything computed (scores, title analysis, recommendations, rankings, taste data, search quality, availability
// counts) is only flagged for staff ("flag"). A page type without parts gets Send feedback only.
//
// The title and person pages ask richer questions (problems.ts) from the page's own data (subject.ts); their chip labels
// here match problems.ts. Parts are found by CSS selector; the title and person pages mark theirs with
// data-feedback-area.

export type Kind = "fix" | "flag"

export type Chip = {
	/** The problem id sent with the report ("wrong-year"). */
	id: string
	label: string
	kind: Kind
}

export type PageArea = {
	id: string
	/** The name in the panel's list and in the badge ("Where to watch"). */
	name: string
	/** The part of the page, as the dock finds it: CSS selectors in order of preference (a wide layout's, then a
	 *  phone's). For each, of the visible matches, ones holding another match are dropped (the innermost wins), then
	 *  the first in page order. */
	selector: string | string[]
	/** The questions, in order. "Something else" is added last by chipsOf(). */
	chips: Chip[]
}

export type PageType = {
	id: string
	name: string
	/** Route files in app/routes/ that render this page type. */
	routes: string[]
	/** An address to try it at. */
	example: string
	match: (path: string) => boolean
	areas: PageArea[]
	note?: string
}

export const SOMETHING_ELSE = "Something else"

/** "A score looks wrong" → "a-score-looks-wrong". */
export const chipId = (label: string) =>
	label
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 50)
const fix = (label: string): Chip => ({ id: chipId(label), label, kind: "fix" })
const flag = (label: string): Chip => ({
	id: chipId(label),
	label,
	kind: "flag",
})

/** An area takes fixes when any of its chips does; otherwise it only takes flags. */
export const kindOf = (a: PageArea): Kind =>
	a.chips.some((c) => c.kind === "fix") ? "fix" : "flag"

/** The chips with "Something else" last: a fix area's goes to staff review, a flag area's is a flag. */
export const chipsOf = (a: PageArea): Chip[] => [
	...a.chips,
	{ id: "other", label: SOMETHING_ELSE, kind: kindOf(a) },
]

const re = (pattern: RegExp) => (path: string) => pattern.test(path)

// Shared parts.
const WATCH: PageArea = {
	id: "watch",
	name: "Where to watch",
	selector: '[data-feedback-area="watch"]',
	chips: [
		fix("It's not on a service listed here"),
		fix("A service has it, but it's missing"),
		fix("A link opens the wrong page"),
	],
}
const TITLE_CARDS = (selector: string, name = "Titles"): PageArea => ({
	id: "titles",
	name,
	selector,
	chips: [
		fix("Wrong year"),
		fix("Wrong streaming service on a title"),
		flag("A score looks wrong"),
		flag("Wrong poster"),
	],
})

export const PAGE_TYPES: PageType[] = [
	{
		id: "start",
		name: "Start page",
		routes: ["_index.tsx", "living-room.tsx (redirect)"],
		example: "/",
		match: (p) => p === "/",
		areas: [
			{
				id: "tv",
				name: "Rows on the TV",
				selector: "[data-tv-screen]",
				chips: [
					fix("A title isn't on this service"),
					fix("A service is missing a title"),
					flag("A pick doesn't fit its row"),
					flag("A score looks wrong"),
				],
			},
			{
				id: "how",
				name: "How it works",
				selector: 'section[aria-labelledby="hgw-h"]',
				chips: [
					flag("A number is out of date"),
					flag("It doesn't work like this"),
				],
			},
		],
	},
	{
		id: "discover",
		name: "Discover",
		routes: ["discover.($type).tsx", "search.tsx (redirect)"],
		example: "/discover",
		match: re(/^\/discover(\/|$)/),
		areas: [
			{
				id: "search",
				name: "Search",
				selector: [
					'button[aria-label="Discover movies and TV shows. Search"]',
					"main h1",
				],
				chips: [
					flag("The best match is wrong"),
					flag("A title I expected is missing"),
					flag("Results don't fit what I typed"),
				],
			},
			{
				id: "filters",
				name: "Filters",
				selector: [
					'main div:has([data-sort-button]):has(button[aria-label="Filters"])',
					'main div:has(> button[aria-label="Filters"])',
				],
				chips: [
					flag("A filter doesn't do what it says"),
					flag("A service is missing from the list"),
					flag("A mood or genre is missing"),
				],
			},
			{
				id: "count",
				name: "Count",
				selector: 'main div:has(> [aria-live="polite"])',
				chips: [flag("The count looks wrong")],
			},
			{
				id: "results",
				name: "Results",
				selector: "main div[aria-busy]:has([data-result-position])",
				chips: [
					fix("Wrong streaming service on a title"),
					fix("Wrong year"),
					flag("A title doesn't fit the filters"),
					flag("A score looks wrong"),
					flag("The order looks wrong"),
				],
			},
		],
	},
	{
		id: "category",
		name: "Category page (by mood, genre or service)",
		routes: [
			"$type._index.tsx",
			"$type.$category._index.tsx",
			"$type.$category.$page.tsx",
			"explore.$type.$category.$text.tsx (redirect)",
			"tv-shows.$.tsx (redirect)",
		],
		example: "/movies/moods",
		match: re(/^\/(movies|shows)(\/(?!best)[^/]+)*\/?$/),
		areas: [
			TITLE_CARDS(
				"main ol, main ul:has(a[href^='/movie/']), main ul:has(a[href^='/show/'])",
			),
			{
				id: "ranking",
				name: "Order",
				selector: "main h1",
				chips: [
					flag("A title doesn't belong here"),
					flag("A title is missing"),
					flag("The order looks wrong"),
				],
			},
		],
	},
	{
		id: "best",
		name: "Best-of list",
		routes: ["$type.best.tsx"],
		example: "/movies/best",
		match: re(/^\/(movies|shows)\/best\/?$/),
		areas: [
			{
				id: "ranking",
				name: "Ranking",
				selector: "main ol[start]",
				chips: [
					flag("A title is ranked too high or low"),
					flag("A title doesn't belong here"),
					flag("A title is missing"),
				],
			},
			{
				id: "titles",
				name: "Title details",
				selector: "main ol[start] > li",
				chips: [
					fix("Wrong year"),
					flag("Wrong genre"),
					flag("A score looks wrong"),
				],
			},
			{
				id: "intro",
				name: "Intro and counts",
				selector: 'main div:has(> h1):has(nav[aria-label="Pages of the list"])',
				chips: [flag("The count looks wrong")],
			},
		],
	},
	{
		id: "people",
		name: "People list",
		routes: ["people.tsx"],
		example: "/people",
		match: (p) => p === "/people",
		areas: [
			{
				id: "people",
				name: "People",
				selector: "main ol, main ul:has(a[href^='/person/'])",
				chips: [
					fix("Wrong known-for title"),
					fix("Wrong main job"),
					flag("Wrong photo"),
					flag("The order looks wrong"),
				],
			},
		],
	},
	{
		id: "title",
		name: "Title page (movie or show)",
		routes: [
			"movie.$movieKey.tsx",
			"show.$showKey.tsx",
			"tv.$showKey.tsx (redirect)",
		],
		example: "/show/136315-the-bear",
		match: re(/^\/(movie|show)\/[^/]+\/?$/),
		areas: [
			{
				id: "scores",
				name: "Scores",
				selector: '[data-feedback-area="scores"]',
				chips: [
					flag("A score looks wrong or old"),
					flag("A score belongs to another title"),
				],
			},
			WATCH,
			{
				id: "analysis",
				name: "Title analysis",
				selector: '[data-feedback-area="analysis"]',
				chips: [
					flag("The description doesn't fit"),
					flag("A scale is off (pace, tone, …)"),
					flag("“Good for” doesn't fit"),
				],
			},
			{
				id: "episodes",
				name: "Episodes",
				selector: '[data-feedback-area="episodes"]',
				chips: [
					fix("Wrong episode title"),
					fix("Wrong air date"),
					fix("An episode is missing"),
					flag("An episode score looks wrong"),
				],
			},
			{
				id: "details",
				name: "Details",
				selector: '[data-feedback-area="details"]',
				chips: [
					fix("Wrong year or date"),
					fix("Wrong number of seasons or episodes"),
					flag("The description is wrong"),
				],
			},
			{
				id: "cast",
				name: "Cast and crew",
				selector: '[data-feedback-area="cast"]',
				chips: [
					fix("Wrong character name"),
					fix("Someone isn't in it"),
					fix("Someone is missing"),
				],
			},
			{
				id: "related",
				name: "Similar titles",
				selector: '[data-feedback-area="related"]',
				chips: [
					flag("A title isn't similar"),
					flag("A title is for a different audience"),
				],
			},
			{
				id: "media",
				name: "Media",
				selector: '[data-feedback-area="media"]',
				chips: [
					flag("A trailer is for another title"),
					flag("A video doesn't play"),
					flag("A video or image doesn't fit"),
				],
			},
		],
		note: "The season and episode view is the Episodes part of a show's page; there is no separate season page.",
	},
	{
		id: "person",
		name: "Person page",
		routes: ["person.$personKey.tsx"],
		example: "/person/287-brad-pitt",
		match: re(/^\/person\/[^/]+\/?$/),
		areas: [
			{
				id: "person",
				name: "Details",
				selector: '[data-feedback-area="person"]',
				chips: [
					fix("Wrong main job"),
					fix("Wrong career years"),
					flag("Wrong photo"),
				],
			},
			{
				id: "standout",
				name: "What stands out",
				selector: '[data-feedback-area="standout"]',
				chips: [flag("A trait doesn't fit them"), flag("The chart looks off")],
			},
			{
				id: "credits",
				name: "Credits",
				selector: '[data-feedback-area="credits"]',
				chips: [
					fix("A title isn't theirs"),
					fix("Wrong role or character"),
					fix("A title is missing"),
				],
			},
		],
	},
	{
		id: "profile",
		name: "Member profile",
		routes: ["u.$handle._index.tsx"],
		example: "/u/<handle>",
		match: re(/^\/u\/[^/]+\/?$/),
		areas: [
			{
				id: "stats",
				name: "Stats",
				selector: "main > header ul:has(> li > a[href$='/seen'])",
				chips: [flag("A count looks wrong"), flag("A chart looks wrong")],
			},
			{
				id: "taste",
				name: "Taste",
				selector: "main section:has(> h2 a[href$='/taste'])",
				chips: [
					flag("The viewer type doesn't fit"),
					flag("A taste word doesn't fit"),
				],
			},
			{
				id: "match",
				name: "Match",
				selector:
					"main div:has(> a[href='/sign-up']), main section:has(> h2 a[href$='/taste#compare'])",
				chips: [flag("The match looks wrong")],
			},
			{
				id: "activity",
				name: "Titles",
				selector: "main section[aria-label='Activity']",
				chips: [
					fix("Wrong year or poster on a title"),
					flag("A title shows that wasn't added"),
					flag("A score shows wrong"),
				],
			},
			{
				id: "scores",
				name: "Score spread",
				selector: "main section:has(> h2 a[href$='/scores'])",
				chips: [flag("The spread looks wrong")],
			},
		],
		note: "What a member writes about themselves (bio, list names, hot takes) is theirs; reporting a member is a separate, later decision.",
	},
	{
		id: "profile-tab",
		name: "Member profile tab",
		routes: [
			"u.$handle.scores.tsx",
			"u.$handle.seen.tsx",
			"u.$handle.shows.tsx",
			"u.$handle.wishlist.tsx",
			"u.$handle.taste.tsx",
			"u.$handle.lists._index.tsx",
		],
		example: "/u/<handle>/taste",
		match: re(/^\/u\/[^/]+\/(scores|seen|shows|wishlist|taste|lists)\/?$/),
		areas: [
			{
				id: "titles",
				name: "Titles",
				selector: "main section:has(a[href^='/movie/'], a[href^='/show/'])",
				chips: [
					fix("Wrong year or poster on a title"),
					flag("A title shows that wasn't added"),
				],
			},
			{
				id: "taste",
				name: "Taste",
				selector: "main section:has(h2):not(:has(a[href^='/movie/']))",
				chips: [
					flag("The viewer type doesn't fit"),
					flag("A taste number looks wrong"),
				],
			},
		],
	},
	{
		id: "list",
		name: "Shared list",
		routes: ["u.$handle.lists.$id.tsx", "lists.$id.tsx"],
		example: "/u/<handle>/lists/<id>",
		match: re(/^\/(u\/[^/]+\/)?lists\/(?!new|mine)[^/]+\/?$/),
		areas: [
			{
				...WATCH,
				selector: "main ol, main ul:has(a[href^='/movie/'], a[href^='/show/'])",
				name: "Titles and services",
			},
		],
	},
	{
		id: "for-you",
		name: "For you",
		routes: ["for-you.tsx"],
		example: "/for-you",
		match: (p) => p === "/for-you",
		areas: [
			{
				id: "picks",
				name: "Picks",
				selector: "main section:has(h2)",
				chips: [
					flag("A pick doesn't fit my taste"),
					flag("I've seen it already"),
					fix("It's not on my services"),
				],
			},
		],
	},
	{
		id: "watch-next",
		name: "Watch next and My movies",
		routes: ["watch-next.tsx", "my-movies.tsx", "wishlist.tsx (redirect)"],
		example: "/watch-next",
		match: re(/^\/(watch-next|my-movies)\/?$/),
		areas: [
			{
				id: "picks",
				name: "Top picks",
				selector: "main section:has(a[href^='/movie/'], a[href^='/show/'])",
				chips: [
					fix("It's not on that service"),
					flag("The order looks wrong"),
					flag("Wrong runtime"),
				],
			},
		],
	},
	{
		id: "library",
		name: "My library",
		routes: [
			"my-library._index.tsx",
			"my-library.$list.tsx",
			"my-library.scores.tsx",
			"my-library.hidden.tsx",
			"my-shows.tsx",
			"lists.mine.tsx",
		],
		example: "/my-library",
		match: re(/^\/(my-library|my-shows|lists\/mine)(\/|$)/),
		areas: [
			{
				id: "titles",
				name: "Titles",
				selector: "main section:has(a[href^='/movie/'], a[href^='/show/'])",
				chips: [
					fix("Wrong next episode or air date"),
					fix("Wrong streaming service"),
					flag("A title I added is missing"),
					flag("A count looks wrong"),
				],
			},
		],
		note: "Members only; signed-out readers see the sign-up prompt and get Send feedback only.",
	},
	{
		id: "taste",
		name: "Taste",
		routes: [
			"taste._index.tsx",
			"taste.quiz.tsx",
			"taste.fingerprint.tsx",
			"taste.everyone.tsx",
			"taste.tsx (layout)",
		],
		example: "/taste",
		match: re(/^\/taste(\/|$)/),
		areas: [
			{
				id: "taste",
				name: "Your taste",
				selector: "main section:has(h2)",
				chips: [
					flag("My viewer type doesn't fit"),
					flag("A taste group doesn't fit"),
					flag("A title to rate is wrong for me"),
				],
			},
		],
	},
	{
		id: "explorer",
		name: "Explorer",
		routes: ["explorer.tsx"],
		example: "/explorer",
		match: (p) => p === "/explorer",
		areas: [
			{
				id: "map",
				name: "Map",
				selector: "main canvas, main svg[role='img']",
				chips: [
					flag("A title is on the wrong island"),
					flag("An island's name doesn't fit"),
				],
			},
		],
	},
	{
		id: "hot",
		name: "Hot",
		routes: ["hot-on-socials.tsx"],
		example: "/hot-on-socials",
		match: (p) => p === "/hot-on-socials",
		areas: [
			{
				id: "ranking",
				name: "Ranking",
				selector: "main ol",
				chips: [
					flag("A title shouldn't be here"),
					flag("A post is about another title"),
					flag("The order looks wrong"),
				],
			},
		],
	},
	{
		id: "blog",
		name: "Blog",
		routes: ["blog._index.tsx", "blog.$slug.tsx"],
		example: "/blog",
		match: re(/^\/blog(\/|$)/),
		areas: [],
	},
	{
		id: "info",
		name: "Info pages",
		routes: [
			"about.tsx",
			"how-it-works.tsx",
			"use-with-ai.tsx",
			"support.tsx",
			"discord._index.tsx",
			"discord.link.tsx",
			"privacy.tsx",
			"terms.tsx",
			"disclaimer.tsx",
		],
		example: "/about",
		match: re(
			/^\/(about|how-it-works|use-with-ai|support|discord|privacy|terms|disclaimer)(\/|$)/,
		),
		areas: [],
	},
	{
		id: "auth",
		name: "Sign in and account access",
		routes: [
			"sign-in.tsx",
			"sign-up.tsx",
			"forgot-password.tsx",
			"reset-password.tsx",
			"verify-email.tsx",
			"auth.mcp.consent.tsx",
		],
		example: "/sign-in",
		match: re(
			/^\/(sign-in|sign-up|forgot-password|reset-password|verify-email|auth\/)/,
		),
		areas: [],
	},
	{
		id: "settings",
		name: "Settings",
		routes: [
			"settings.tsx (layout)",
			"settings._index.tsx",
			"settings.account.tsx",
			"settings.profile.tsx",
			"settings.services.tsx",
			"settings.country.tsx",
			"settings.language.tsx",
			"settings.imports.tsx",
			"settings.connected-apps.tsx",
			"settings.discover-privacy.tsx",
		],
		example: "/settings",
		match: re(/^\/settings(\/|$)/),
		areas: [],
	},
	{
		id: "list-edit",
		name: "List editor",
		routes: ["lists.new.tsx", "u.$handle_.lists.$id_.edit.tsx"],
		example: "/lists/new",
		match: re(/^\/(lists\/new|u\/[^/]+\/lists\/[^/]+\/edit)\/?$/),
		areas: [],
	},
]

/** The page type at an address; unknown addresses (and error pages) get Send feedback only. */
export function pageTypeOf(path: string): PageType | null {
	const p = path.length > 1 ? path.replace(/\/$/, "") : path
	return PAGE_TYPES.find((t) => t.match(p)) ?? null
}
