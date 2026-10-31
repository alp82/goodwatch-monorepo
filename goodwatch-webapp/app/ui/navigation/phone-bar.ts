// The phone's top bar (below lg), from the path alone: which kind of bar a page gets, the small area label over the big
// page title, and the sibling pages its title opens. Pure: PhoneBar.tsx draws it; areas.ts and watch-views.ts hold the
// tabs. Desktop keeps the header and the tab rows.
//
// Phones show at most two persistent bars: this one at the top and the dock at the bottom. An area's tab row moves
// into the sheet the title opens (and the area's dock key, from any page); the views under a tab are a quiet text row
// in the page (SubNav.tsx).
//
// Kinds:
// - home: the start page keeps the wordmark.
// - area: Watch, Explore and Profile pages: "WATCH" over "My shows ▾"; the title opens the area's tabs.
// - search: Discover in search mode (?q=): the bar is the search field.
// - detail: a title, a person, a list or a blog post: back, and the page's own name once its heading scrolled away.
// - settings: a settings page: "‹ Settings" and its name; this bar never hides.
// - page: everything else (help, apps, sign-in): "GOODWATCH" over the page's name, no menu.
import { SETTINGS_PATHS, type PathViewer } from "../../domain/member-paths.ts"
import {
	type AreaKey,
	type AreaTab,
	SETTINGS_COLUMN,
	areaOf,
	exploreTabs,
	placeHere,
	tasteRow,
} from "./areas.ts"
import { seenTab, watchTabsFor } from "../watch/watch-views.ts"

export type PhoneBarKind =
	| "home"
	| "area"
	| "search"
	| "detail"
	| "settings"
	| "page"

export interface PhoneBar {
	kind: PhoneBarKind
	area: AreaKey | null
	/** The small uppercase line over the title ("Watch", "Profile", "@handle", "GoodWatch"). */
	eyebrow: string
	/** The big title; empty on a detail page (the page's heading fills it in once it scrolled away). */
	title: string
	/** The current tab's icon, amber before the title on area pages. */
	icon?: AreaTab["icon"]
	/** The sibling pages the title opens; empty: the title is plain text. */
	siblings: AreaTab[]
	/** Where back leads when there is no earlier page in this tab (detail and settings). */
	back?: { href: string; label: string }
	/** True: the bar stays put while the page scrolls. */
	pinned: boolean
}

const trim = (pathname: string) =>
	pathname.length > 1 && pathname.endsWith("/")
		? pathname.slice(0, -1)
		: pathname

/** Pages outside the areas with a plain title: help, apps, legal and the sign-in pages. */
const PAGE_TITLES: [RegExp, string][] = [
	[/^\/for-you$/, "For you"],
	[/^\/living-room$/, "Living room"],
	[/^\/how-it-works$/, "How it works"],
	[/^\/about$/, "About"],
	[/^\/blog$/, "Blog"],
	[/^\/use-with-ai$/, "Use with AI"],
	[/^\/support$/, "Support"],
	[/^\/discord(\/.*)?$/, "Discord bot"],
	[/^\/privacy$/, "Privacy"],
	[/^\/terms$/, "Terms"],
	[/^\/disclaimer$/, "Disclaimer"],
	[/^\/sign-in$/, "Sign in"],
	[/^\/sign-up$/, "Sign up"],
	[/^\/forgot-password$/, "Forgot password"],
	[/^\/reset-password$/, "New password"],
	[/^\/verify-email$/, "Verify email"],
	[/^\/signed-out$/, "Signed out"],
	[/^\/wishlist$/, "Wishlist"],
	[/^\/watch-next$/, "Watch next"],
]

/** A title, a person, a list, a list's editor or a blog post: one long page of its own. */
function detailOf(
	path: string,
	viewer: PathViewer,
): { href: string; label: string } | null {
	if (/^\/(movie|show|tv|person)\/[^/]+/.test(path))
		return { href: "/", label: "" }
	if (/^\/blog\/[^/]+$/.test(path)) return { href: "/blog", label: "" }
	const list = /^(?:\/u\/([^/]+))?\/lists\/(?!mine$)([^/]+)(?:\/edit)?$/.exec(
		path,
	)
	if (list) {
		const handle = list[1] ?? (viewer.kind === "member" ? viewer.handle : null)
		return {
			href: handle ? `/u/${handle}/lists` : "/lists/mine",
			label: "",
		}
	}
	return null
}

/** The bar for a page. `search` is the query string (Discover's ?q= turns it into the search field). */
export function phoneBarOf({
	pathname,
	search = "",
	viewer,
}: {
	pathname: string
	search?: string
	viewer: PathViewer
}): PhoneBar {
	const path = trim(pathname)
	const base = { siblings: [] as AreaTab[], pinned: false }
	if (path === "/")
		return { ...base, kind: "home", area: null, eyebrow: "", title: "" }

	const detail = detailOf(path, viewer)
	if (detail)
		return {
			...base,
			kind: "detail",
			area: areaOf(path),
			eyebrow: "",
			title: "",
			back: detail,
		}

	const area = areaOf(path)
	if (path.startsWith("/discover") && new URLSearchParams(search).get("q"))
		return { ...base, kind: "search", area, eyebrow: "Search", title: "" }

	if (path.startsWith(`${SETTINGS_PATHS.home}/`)) {
		const place = SETTINGS_COLUMN.flatMap((g) => g.places).find((p) =>
			placeHere(p, path),
		)
		return {
			...base,
			kind: "settings",
			area,
			eyebrow: "Settings",
			title: place?.label ?? "Settings",
			back: { href: SETTINGS_PATHS.home, label: "Settings" },
			pinned: true,
		}
	}

	const tabs = areaTabsOf(area, path, search, viewer)
	if (tabs) {
		const here = tabs.tabs.find((t) => t.here)
		const settingsHome = path === SETTINGS_PATHS.home
		return {
			...base,
			kind: "area",
			area,
			eyebrow: tabs.label,
			title: settingsHome ? "Settings" : (here?.label ?? tabs.label),
			icon: settingsHome ? undefined : here?.icon,
			siblings: tabs.tabs,
		}
	}

	const title = PAGE_TITLES.find(([re]) => re.test(path))?.[1] ?? ""
	return { ...base, kind: "page", area, eyebrow: "GoodWatch", title }
}

/** An area's tabs as one list (the visitors-only and Seen tabs at the end), and the label over the title. */
export function areaTabsOf(
	area: AreaKey | null,
	path: string,
	search: string,
	viewer: PathViewer,
): { label: string; tabs: AreaTab[] } | null {
	if (area === "watch")
		return { label: "Watch", tabs: [...watchTabsFor(path), seenTab(path)] }
	if (area === "explore") return { label: "Explore", tabs: exploreTabs(path) }
	if (area === "taste") {
		const row = tasteRow({ pathname: path, search, viewer })
		if (!row) return null
		return { label: row.label, tabs: [...row.tabs, ...row.trailing] }
	}
	return null
}

/**
 * The sheet a dock key opens: the area's pages as seen from its first page (`href`), none marked as the page you're
 * on. Null when the area has no pages for this viewer, so the key just goes to `href`.
 */
export function areaSheetOf(
	area: AreaKey,
	href: string,
	viewer: PathViewer,
): { label: string; tabs: AreaTab[] } | null {
	const [path, query = ""] = href.split("?")
	const sheet = areaTabsOf(area, trim(path), query ? `?${query}` : "", viewer)
	if (!sheet || sheet.tabs.length === 0) return null
	return { ...sheet, tabs: sheet.tabs.map((t) => ({ ...t, here: false })) }
}
