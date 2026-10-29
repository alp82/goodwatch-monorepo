// The top of the Taste area: the profile header (picture, @handle, viewer type, a few counts, and for the owner "Your
// view | View as visitor") and the Taste tab row under it. It has one height on every tab and on Settings, so moving
// between them never shifts the page. A member without a handle gets a strip of the same height that asks for one.
import { EyeIcon, UserCircleIcon } from "@heroicons/react/24/outline"
import { Link } from "@remix-run/react"
import {
	AUDIENCES,
	type Audience,
	type ProfileShell,
	canSee,
	seesPart,
} from "~/domain/profile"
import {
	EDIT_PROFILE_PATH,
	type PathViewer,
	tastePath,
} from "~/domain/member-paths"
import { type TasteTabKey, tasteRow } from "~/ui/navigation/areas"
import { TasteTabs } from "~/ui/navigation/AreaTabs"
import { DISPLAY, WRAP } from "~/ui/my-pages/bits"
import { ProfileAvatar } from "./ProfileFrame"
import { PROFILE_TAB_PARTS, type ProfileTab } from "./paths"
import { AMBER_BUTTON, QUIET_BUTTON, ShareButton, count, posterUrl } from "./parts"

/** The header's one height: one row on phones, a taller row from sm up. The handle strip uses it too. */
const HEADER_BOX = "h-[88px] sm:h-[120px]"

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

/**
 * Where "Your view | View as visitor" leads from this page. The owner-only pages (Not rated, Rate more) have no
 * visitor view, so they switch to Scores; the visitors-only tabs (Seen, Wishlist, Shows) switch back to the profile.
 */
function viewSwitchHref(handle: string, pathname: string, toVisitor: boolean) {
	const query = toVisitor ? { as: "visitor" } : undefined
	// Off the profile (Settings): the profile itself.
	if (!/^\/u\/[^/]+/.test(pathname)) return tastePath(handle, "profile", query)
	const rest = pathname.replace(/^\/u\/[^/]+/, "").replace(/\/$/, "")
	if (toVisitor && rest.startsWith("/scores/"))
		return tastePath(handle, "scores", query)
	if (!toVisitor && ["/seen", "/wishlist", "/shows"].includes(rest))
		return tastePath(handle)
	return `/u/${handle}${rest}${toVisitor ? "?as=visitor" : ""}`
}

const SEG_TRACK =
	"inline-flex shrink-0 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10"
const seg = (on: boolean) =>
	`flex h-9 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-sm transition-colors ${
		on ? "bg-white font-bold text-gray-950" : "text-gray-300 hover:text-white"
	}`

function ViewSwitch({
	handle,
	pathname,
	asVisitor,
}: { handle: string; pathname: string; asVisitor: boolean }) {
	const own = viewSwitchHref(handle, pathname, false)
	const visitor = viewSwitchHref(handle, pathname, true)
	return (
		<>
			<nav aria-label="Whose view" className={`${SEG_TRACK} max-sm:hidden`}>
				<Link
					to={own}
					replace
					preventScrollReset
					aria-current={asVisitor ? undefined : "page"}
					className={seg(!asVisitor)}
				>
					Your view
				</Link>
				<Link
					to={visitor}
					replace
					preventScrollReset
					aria-current={asVisitor ? "page" : undefined}
					className={seg(asVisitor)}
				>
					View as visitor
				</Link>
			</nav>
			{/* Phones: one key, so the header stays one row. */}
			<Link
				to={asVisitor ? own : visitor}
				replace
				preventScrollReset
				aria-label={asVisitor ? "Back to your view" : "View as visitor"}
				aria-pressed={asVisitor}
				className={`flex size-10 items-center justify-center rounded-full ring-1 sm:hidden ${
					asVisitor
						? "bg-amber-400/20 text-amber-200 ring-amber-400/50"
						: "bg-white/[0.06] text-gray-300 ring-white/10"
				}`}
			>
				<EyeIcon className="size-5" aria-hidden />
			</Link>
		</>
	)
}

function Stat({ n, label, to }: { n: number; label: string; to?: string }) {
	const inner = (
		<>
			<b className="font-bold text-gray-100 tabular-nums">{count(n)}</b> {label}
		</>
	)
	return to ? (
		<Link to={to} prefetch="intent" className="whitespace-nowrap hover:text-white">
			{inner}
		</Link>
	) : (
		<span className="whitespace-nowrap">{inner}</span>
	)
}

/**
 * The profile header. `shell` is the shell as the viewer sees it (for the owner's visitor view, `asGuestSees`), and
 * `owner` says the viewer owns the profile, so the view switch shows in both views.
 */
export function ProfileHeader({
	shell,
	identity,
	owner,
	asVisitor,
	pathname,
}: {
	shell: ProfileShell
	/** The viewer type ("Restless Romantic Dreamer"), when the viewer may see the taste. */
	identity: string | null
	owner: boolean
	asVisitor: boolean
	pathname: string
}) {
	const c = shell.counts
	const see = (part: Parameters<typeof seesPart>[1]) => seesPart(shell, part)
	const query = asVisitor ? { as: "visitor" } : undefined
	return (
		<header className="relative isolate shrink-0 overflow-hidden" data-profile-header>
			{shell.cover && (
				<img
					src={posterUrl(shell.cover.backdrop, "w780") ?? ""}
					alt=""
					className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_30%] opacity-20"
				/>
			)}
			<div className="absolute inset-0 -z-10 bg-linear-to-t from-gray-950 via-gray-950/85 to-gray-950/50" />
			<div className={`${WRAP} ${HEADER_BOX} flex items-center gap-3 sm:gap-5`}>
				<div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
					<span className="sm:hidden">
						<ProfileAvatar handle={shell.handle} avatar={shell.avatar} size="sm" />
					</span>
					<span className="max-sm:hidden">
						<ProfileAvatar handle={shell.handle} avatar={shell.avatar} size="md" />
					</span>
					<div className="min-w-0 flex-1">
						<h1
							className={`${DISPLAY} truncate text-xl leading-tight text-white sm:text-3xl`}
						>
							@{shell.handle}
						</h1>
						{identity && (
							<p className="truncate text-sm font-semibold text-violet-200">
								{identity}
							</p>
						)}
						<p className="mt-0.5 flex gap-x-3 overflow-hidden text-xs text-gray-400 sm:mt-1 sm:text-sm">
							{see("seen") && <Stat n={c.seen} label="seen" />}
							{see("scores") && (
								<Stat
									n={c.rated}
									label="scores"
									to={tastePath(shell.handle, "scores", query)}
								/>
							)}
							{see("lists") && (
								<Stat
									n={c.lists}
									label={c.lists === 1 ? "list" : "lists"}
									to={tastePath(shell.handle, "lists", query)}
								/>
							)}
							{see("hours") && (
								<Stat n={Math.round(c.hours / 24)} label="days watched" />
							)}
						</p>
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{owner ? (
						<ViewSwitch
							handle={shell.handle}
							pathname={pathname}
							asVisitor={asVisitor}
						/>
					) : (
						<ShareButton handle={shell.handle} className={QUIET_BUTTON} compact />
					)}
				</div>
			</div>
		</header>
	)
}

/** In place of the profile header for a member without a handle: the same height, and the way to pick one. */
export function HandleStrip() {
	return (
		<header className="relative isolate shrink-0 overflow-hidden" data-profile-header>
			<div className="absolute inset-0 -z-10 bg-linear-to-t from-gray-950 via-gray-950/85 to-gray-900/60" />
			<div className={`${WRAP} ${HEADER_BOX} flex items-center gap-3 sm:gap-5`}>
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
				<Link to={EDIT_PROFILE_PATH} prefetch="intent" className={`${AMBER_BUTTON} shrink-0`}>
					Pick your handle
				</Link>
			</div>
		</header>
	)
}

/**
 * The profile header and the Taste row. `shell` is the real one (the owner's own on their profile); with `asVisitor`
 * the header and the tabs show what a signed-out visitor sees.
 */
export function ProfileChrome({
	shell,
	identity,
	pathname,
	search,
}: {
	shell: ProfileShell
	/** The viewer type, from the owner's taste; shown when the viewer may see the taste. */
	identity: string | null
	pathname: string
	search: string
}) {
	const owner = shell.viewer === "owner"
	const asVisitor =
		owner && new URLSearchParams(search).get("as") === "visitor"
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
	return (
		<>
			<ProfileHeader
				shell={view}
				identity={seesPart(view, "taste") ? identity : null}
				owner={owner}
				asVisitor={asVisitor}
				pathname={pathname}
			/>
			{row && <TasteTabs row={row} />}
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
