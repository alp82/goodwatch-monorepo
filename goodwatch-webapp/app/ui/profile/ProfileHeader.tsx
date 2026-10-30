// The top of the Profile area: the profile header (picture, @handle, viewer type, a few counts, Share, and for the
// owner a way to view the profile as visitors see it) and the Profile tab row under it. The header has one height on
// every tab, list page and Settings page, so moving between them never shifts the page. A member without a handle gets
// a strip of the same height that asks for one.
// PROTOTYPE OPTIONS (member nav, round 8): the header layout (`header`) and View as visitor (`visitor`) come from
// nav-options.ts; the layouts are in header/Layouts.tsx and the visitor controls in header/VisitorView.tsx.
import { UserCircleIcon } from "@heroicons/react/24/outline"
import { Link } from "@remix-run/react"
import { EDIT_PROFILE_PATH, type PathViewer } from "~/domain/member-paths"
import {
	AUDIENCES,
	type Audience,
	type ProfileShell,
	canSee,
	seesPart,
} from "~/domain/profile"
import { DISPLAY, WRAP } from "~/ui/my-pages/bits"
import { TasteTabs } from "~/ui/navigation/AreaTabs"
import { type TasteTabKey, tasteRow } from "~/ui/navigation/areas"
import { useNavOptions } from "~/ui/navigation/nav-options"
import {
	BOX,
	type HeaderLook,
	type HeaderProps,
	LAYOUTS,
} from "./header/Layouts"
import {
	EyeKey,
	PreviewItem,
	TAB_ROW_TINT,
	VisitorBadge,
	VisitorBar,
	VisitorSwitch,
	viewSwitchHref,
} from "./header/VisitorView"
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

/** The profile header in the layout the options pick (header/Layouts.tsx). */
export function ProfileHeader(props: HeaderProps & { look: HeaderLook }) {
	const Layout = LAYOUTS[props.look]
	return <Layout {...props} />
}

/** In place of the profile header for a member without a handle: the same height, and the way to pick one. */
export function HandleStrip() {
	const { header: look } = useNavOptions()
	return (
		<header
			className={`relative isolate shrink-0 overflow-hidden ${BOX[look]}`}
			data-profile-header={look}
			data-handle-strip
		>
			<div className="absolute inset-0 -z-10 bg-linear-to-t from-gray-950 via-gray-950/85 to-gray-900/60" />
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
		</header>
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
	posters = [],
	pathname,
	search,
}: {
	shell: ProfileShell
	/** The viewer type, from the owner's taste; shown when the viewer may see the taste. */
	identity: string | null
	/** The taste print, under the same rule. */
	print?: WhorlAttribute[] | null
	/** The best scored posters; shown when the viewer may see the scores. */
	posters?: string[]
	pathname: string
	search: string
}) {
	const options = useNavOptions()
	const owner = shell.viewer === "owner"
	const onProfile = /^\/u\/[^/]+/.test(pathname)
	const asVisitor =
		owner && onProfile && new URLSearchParams(search).get("as") === "visitor"
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
	const visitor = owner && onProfile ? options.visitor : null
	const links = {
		own: viewSwitchHref(shell.handle, pathname, false),
		visitor: viewSwitchHref(shell.handle, pathname, true),
		on: asVisitor,
	}
	const props: HeaderProps = {
		shell: view,
		identity: seesPart(view, "taste") ? identity : null,
		print: seesPart(view, "taste") ? print : null,
		posters: seesPart(view, "scores") ? posters : [],
		query: asVisitor ? { as: "visitor" } : undefined,
		control:
			visitor === "bar" ? ( // OPTION visitor=bar
				<EyeKey {...links} />
			) : visitor === "switch" ? ( // OPTION visitor=switch
				<VisitorSwitch {...links} />
			) : null,
		edit: options.header === "card" && owner && !asVisitor,
		badge: visitor === "switch" && asVisitor ? <VisitorBadge /> : null,
		ring: visitor === "bar" && asVisitor,
		tint: visitor === "switch" && asVisitor,
	}
	const tintRow = asVisitor && (visitor === "switch" || visitor === "preview")
	return (
		<>
			{visitor === "bar" && asVisitor && <VisitorBar own={links.own} />}
			<ProfileHeader {...props} look={options.header} />
			{row && (
				// `contents` keeps the row a sticky child of the page while the wrapper tints it.
				<div className={`contents ${tintRow ? TAB_ROW_TINT : ""}`}>
					<TasteTabs
						row={row}
						before={
							visitor === "preview" ? ( // OPTION visitor=preview
								<PreviewItem {...links} />
							) : undefined
						}
					/>
				</div>
			)}
		</>
	)
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
