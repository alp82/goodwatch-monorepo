// The top of the Profile area: the profile header (the fingerprint and picture, @handle, the profile's essence, Share,
// and for the owner a way to view the profile as visitors see it) and the Profile tab row under it. The header has one
// height on every tab, list page and Settings page, so moving between them never shifts the page. A member without a
// handle gets a strip of the same height that asks for one. While the owner views as a visitor, the amber bar sticks
// under the site header (header/VisitorView.tsx).
import { UserCircleIcon } from "@heroicons/react/24/outline"
import { Link, useLocation } from "@remix-run/react"
import { EDIT_PROFILE_PATH, type PathViewer } from "~/domain/member-paths"
import {
	AUDIENCES,
	type Audience,
	type ProfileShell,
	canSee,
	seesPart,
} from "~/domain/profile"
import type { HeaderMatch } from "~/server/profile/header.server"
import { DISPLAY, WRAP } from "~/ui/my-pages/bits"
import { TasteTabs } from "~/ui/navigation/AreaTabs"
import { type TasteTabKey, tasteRow } from "~/ui/navigation/areas"
import type { ShareTarget } from "./header/Controls"
import { Frame, InlineHeader } from "./header/Layouts"
import { VisitorBar, viewSwitchHref } from "./header/VisitorView"
import { headerFacts, joinedMonth } from "./header/facts"
import { AMBER_BUTTON } from "./parts"
import { PROFILE_TAB_PARTS, type ProfileTab } from "./paths"
import type { WhorlAttribute } from "./taste/Whorl"

/**
 * The shell as a signed-out visitor sees it: the owner's own shell with every part guests may not see emptied. The
 * owner's "View as visitor" draws the header from it without loading the profile again.
 */
export function asGuestSees(shell: ProfileShell): ProfileShell {
	if (shell.viewer === "guest") return shell
	const see = (part: Parameters<typeof canSee>[1]) =>
		canSee(shell.visibility, part, "guest")
	const c = shell.counts
	return {
		...shell,
		viewer: "guest",
		since: see("scores") || see("seen") ? shell.since : null,
		counts: {
			seen: see("seen") ? c.seen : 0,
			seenMovies: see("seen") ? c.seenMovies : 0,
			rated: see("scores") ? c.rated : 0,
			wishlist: see("wishlist") ? c.wishlist : 0,
			lists: see("lists") ? c.lists : 0,
			hours: see("hours") ? c.hours : 0,
			episodes: see("hours") ? c.episodes : 0,
			average: see("scores") ? c.average : null,
		},
		spread: see("scores") ? shell.spread : shell.spread.map(() => 0),
		dismissedImports: [],
	}
}

/** The profile tab each Taste tab is, for the parts it needs. */
const TAB_OF: Partial<Record<TasteTabKey, ProfileTab>> = {
	profile: "overview",
	tropes: "tropes",
	scores: "scores",
	stats: "stats",
	lists: "lists",
	seen: "seen",
	wishlist: "wishlist",
	shows: "shows",
}

const partsOf = (tab: TasteTabKey) => {
	const profileTab = TAB_OF[tab]
	return profileTab ? PROFILE_TAB_PARTS[profileTab] : []
}

/** The strictest audience of a tab's parts, for the owner's lock or members mark. */
function audienceOf(shell: ProfileShell, tab: TasteTabKey): Audience {
	return partsOf(tab)
		.map((p) => shell.visibility[p])
		.reduce<Audience>(
			(a, b) => (AUDIENCES.indexOf(b) > AUDIENCES.indexOf(a) ? b : a),
			"everyone",
		)
}

/** In place of the profile header for a member without a handle: the same height, and the way to pick one. */
export function HandleStrip() {
	return (
		<Frame ring={false} strip>
			<div className={`${WRAP} flex h-full items-center gap-3 sm:gap-5`}>
				<UserCircleIcon
					className="size-11 shrink-0 text-gray-500 sm:size-16"
					aria-hidden
				/>
				<div className="min-w-0 flex-1">
					<h1
						className={`${DISPLAY} truncate text-xl leading-tight text-white sm:text-3xl`}
					>
						Your taste
					</h1>
					<p className="truncate text-xs text-gray-400 sm:text-sm">
						Pick a handle to get a profile you can share.
					</p>
				</div>
				<Link
					to={EDIT_PROFILE_PATH}
					prefetch="intent"
					className={`${AMBER_BUTTON} shrink-0`}
				>
					Pick your handle
				</Link>
			</div>
		</Frame>
	)
}

/** Whether the owner is viewing their profile as a visitor (?as=visitor on a profile page; never on Settings). */
export function isVisitorView(
	shell: Pick<ProfileShell, "viewer">,
	pathname: string,
	search: string,
) {
	return (
		shell.viewer === "owner" &&
		/^\/u\/[^/]+/.test(pathname) &&
		new URLSearchParams(search).get("as") === "visitor"
	)
}

/**
 * The profile header and the Profile row. `shell` is the real one (the owner's own on their profile); with
 * ?as=visitor the header and the tabs show what a signed-out visitor sees. Settings never has the visitor view.
 */
export function ProfileChrome({
	shell,
	identity,
	print = null,
	match = null,
	pathname,
	search,
}: {
	shell: ProfileShell
	/** The viewer type, from the owner's taste; shown when the viewer may see the taste. */
	identity: string | null
	/** The taste print, under the same rule. */
	print?: WhorlAttribute[] | null
	/** The signed-in visitor's match, on someone else's profile. */
	match?: HeaderMatch | null
	pathname: string
	search: string
}) {
	const location = useLocation()
	const owner = shell.viewer === "owner"
	const onProfile = /^\/u\/[^/]+/.test(pathname)
	const asVisitor = isVisitorView(shell, pathname, search)
	const view = asVisitor ? asGuestSees(shell) : shell
	const viewer: PathViewer = owner
		? { kind: "member", handle: shell.handle }
		: { kind: shell.viewer === "member" ? "member" : "guest", handle: null }
	const row = tasteRow({
		pathname,
		search,
		viewer,
		counts: {
			scores: view.counts.rated,
			lists: view.counts.lists,
			seen: view.counts.seen,
			wishlist: view.counts.wishlist,
		},
		visible: (tab) => partsOf(tab).every((part) => seesPart(view, part)),
		mark: (tab) => {
			const audience = audienceOf(shell, tab)
			return audience === "everyone" ? undefined : audience
		},
	})

	// The owner's way to view as a visitor: on the profile's pages only, never on Settings.
	const controls = {
		share: shareTargets(shell.handle, row?.tabs ?? [], location.pathname),
		handle: shell.handle,
		view:
			owner && onProfile
				? {
						own: viewSwitchHref(shell.handle, pathname, false),
						visitor: viewSwitchHref(shell.handle, pathname, true),
						on: asVisitor,
					}
				: null,
		edit: owner && !asVisitor,
	}
	const query = asVisitor ? { as: "visitor" } : undefined
	return (
		<>
			{asVisitor && controls.view && <VisitorBar own={controls.view.own} />}
			<InlineHeader
				shell={view}
				identity={seesPart(view, "taste") ? identity : null}
				print={seesPart(view, "taste") ? print : null}
				facts={headerFacts(view, query)}
				since={joinedMonth(view)}
				controls={controls}
				match={shell.viewer === "member" ? match : null}
				ring={asVisitor}
			/>
			{row && <TasteTabs row={row} />}
		</>
	)
}

/**
 * What Share offers: the profile, and the page you're on when it is a tab or a list. A tab shares its own address (a
 * Stats view included); the owner-only pages under Scores share Scores.
 */
function shareTargets(
	handle: string,
	tabs: { key: string; label: string; href: string; here: boolean }[],
	pathname: string,
): ShareTarget[] {
	const profile = { name: "Profile", path: `/u/${handle}` }
	const path = pathname.replace(/\/$/, "")
	if (/^(\/u\/[^/]+)?\/lists\/(?!new$|mine$)[^/]+$/.test(path))
		return [profile, { name: "This list", path }]
	const tab = tabs.find((t) => t.here)
	if (!tab || tab.key === "profile" || !path.startsWith("/u/")) return [profile]
	const tabPath = new URL(tab.href, "https://goodwatch.app").pathname
	return [
		profile,
		{
			name: `${tab.label} tab`,
			path:
				path.startsWith(tabPath) &&
				!path.startsWith(`${tabPath}/rate`) &&
				!path.startsWith(`${tabPath}/not-rated`)
					? path
					: tabPath,
		},
	]
}

/** The handle strip and the Taste row without a profile (/taste, Settings), for a member without a handle. */
export function NoHandleChrome({
	pathname,
	search,
}: { pathname: string; search: string }) {
	const row = tasteRow({
		pathname,
		search,
		viewer: { kind: "member", handle: null },
	})
	return (
		<>
			<HandleStrip />
			{row && <TasteTabs row={row} />}
		</>
	)
}
