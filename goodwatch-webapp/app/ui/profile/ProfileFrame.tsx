import {
	LockClosedIcon,
	PencilSquareIcon,
	SparklesIcon,
	UserGroupIcon,
} from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import type { CSSProperties, ReactNode } from "react"
import {
	AUDIENCES,
	type Audience,
	type ProfilePart,
	type ProfileShell,
	seesPart,
} from "~/domain/profile"
import { STICKY_BAR } from "~/ui/layers"
import { DISPLAY, WRAP } from "~/ui/my-pages/bits"
// The frame of every profile page: the picture, @handle, since, bio, links and actions (in full on Overview, compact on
// the other tabs), the stat strip, the tabs (only the parts the viewer may see; the owner sees a lock or a members
// mark on a narrowed part), and the notice in place of a part the viewer may not see. Nothing here may widen a phone's layout (overflow-x-clip keeps the sticky tabs working).
import { assetUrl } from "~/utils/asset-url"
import {
	EDIT_PROFILE_PATH,
	LINK_SERVICE_INFO,
	type ProfileTab,
	linkUrl,
	profileTabPath,
} from "./links"
import {
	AMBER_BUTTON,
	HiddenPart,
	ICON_ON_PHONE,
	QUIET_BUTTON,
	ShareButton,
	count,
	posterUrl,
	vibe,
} from "./parts"

const AVATAR_GRADIENT: Record<string, [string, string, string]> = {
	amber: ["#fbbf24", "#b45309", "#451a03"],
	rose: ["#fb7185", "#be123c", "#4c0519"],
	violet: ["#a78bfa", "#6d28d9", "#2e1065"],
	sky: ["#38bdf8", "#0369a1", "#082f49"],
	emerald: ["#34d399", "#047857", "#022c22"],
	slate: ["#e2e8f0", "#64748b", "#0f172a"],
}

export function ProfileAvatar({
	handle,
	avatar,
	size = "lg",
}: {
	handle: string
	avatar: ProfileShell["avatar"]
	size?: "sm" | "md" | "lg"
}) {
	const box = {
		sm: "size-11 text-lg ring-2",
		md: "size-16 text-3xl ring-4",
		lg: "size-14 text-2xl ring-4 sm:size-20 sm:text-4xl",
	}[size]
	const cls = `${box} shrink-0 rounded-full ring-gray-950 shadow-xl`
	if (avatar.url)
		return (
			<img
				src={avatar.url}
				alt=""
				data-member-avatar
				className={`${cls} object-cover object-top`}
			/>
		)
	const [from, to, ink] = AVATAR_GRADIENT[avatar.color] ?? AVATAR_GRADIENT.amber
	return (
		<span
			aria-hidden
			className={`${cls} flex items-center justify-center font-extrabold`}
			style={{
				background: `linear-gradient(135deg, ${from}, ${to})`,
				color: ink,
			}}
		>
			{handle.charAt(0).toUpperCase()}
		</span>
	)
}

const TABS: {
	tab: ProfileTab
	label: string
	part?: ProfilePart
	/** A second part the tab needs; the narrower audience of the two marks it. */
	also?: ProfilePart
	count?: (s: ProfileShell) => number
}[] = [
	{ tab: "overview", label: "Overview" },
	{ tab: "seen", label: "Seen", part: "seen", count: (s) => s.counts.seen },
	{
		tab: "scores",
		label: "Scores",
		part: "scores",
		count: (s) => s.counts.rated,
	},
	{
		tab: "wishlist",
		label: "Wishlist",
		part: "wishlist",
		count: (s) => s.counts.wishlist,
	},
	{ tab: "shows", label: "Shows", part: "shows" },
	{ tab: "lists", label: "Lists", part: "lists", count: (s) => s.counts.lists },
	{ tab: "stats", label: "Stats", part: "taste" },
	{ tab: "tropes", label: "Tropes", part: "taste", also: "scores" },
]

/** "2019-03" → "March 2019". */
const monthYear = (ym: string) => {
	const [y, m] = ym.split("-").map(Number)
	return new Date(Date.UTC(y, (m || 1) - 1, 1)).toLocaleDateString("en-US", {
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	})
}

export function ProfileTabs({
	shell,
	active,
}: { shell: ProfileShell; active: ProfileTab }) {
	const owner = shell.viewer === "owner"
	return (
		<nav
			aria-label="Profile"
			className={`sticky top-14 ${STICKY_BAR} border-b border-white/10 bg-gray-950/95 md:top-16`}
		>
			<div
				className={`${WRAP} flex gap-1 overflow-x-auto [scrollbar-width:none]`}
			>
				{TABS.filter(
					(t) =>
						(!t.part || seesPart(shell, t.part)) &&
						(!t.also || seesPart(shell, t.also)),
				).map((t) => {
					const here = t.tab === active
					const audience = [t.part, t.also]
						.map((p): Audience => (p ? shell.visibility[p] : "everyone"))
						.reduce((a, b) =>
							AUDIENCES.indexOf(b) > AUDIENCES.indexOf(a) ? b : a,
						)
					const n = t.count?.(shell)
					return (
						<Link
							key={t.tab}
							to={profileTabPath(shell.handle, t.tab)}
							prefetch="intent"
							aria-current={here ? "page" : undefined}
							className={`relative flex min-h-12 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-semibold whitespace-nowrap ${
								here
									? "border-amber-400 text-white"
									: "border-transparent text-gray-400 hover:text-gray-100"
							}`}
						>
							{t.label}
							{n != null && (
								<span className="text-xs tabular-nums text-gray-500">
									{count(n)}
								</span>
							)}
							{owner && audience === "me" && (
								<LockClosedIcon
									className="size-3.5 text-amber-300/80"
									aria-label="Only you see this"
								/>
							)}
							{owner && audience === "members" && (
								<UserGroupIcon
									className="size-3.5 text-sky-300/80"
									aria-label="Members only"
								/>
							)}
						</Link>
					)
				})}
			</div>
		</nav>
	)
}

function LinkLogos({ shell }: { shell: ProfileShell }) {
	const links = shell.links.filter((l) => l.value.trim())
	if (!links.length) return null
	return (
		<ul className="flex gap-1.5">
			{links.map((l) => {
				const service = LINK_SERVICE_INFO[l.service]
				return (
					<li key={l.service}>
						<a
							href={linkUrl(l)}
							rel="noreferrer me nofollow noopener"
							target="_blank"
							aria-label={`${service.name} profile (opens in a new tab)`}
							title={`${service.name} (opens in a new tab)`}
							className="flex size-9 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/15 hover:bg-white/[0.12] sm:size-10"
						>
							{service.logo ? (
								<img
									src={assetUrl(service.logo)}
									alt=""
									className="size-5 object-contain"
								/>
							) : (
								<span className="text-sm font-black text-gray-200">
									{service.letter}
								</span>
							)}
						</a>
					</li>
				)
			})}
		</ul>
	)
}

function Actions({ shell }: { shell: ProfileShell }) {
	if (shell.viewer === "owner")
		return (
			<>
				<ShareButton handle={shell.handle} compact />
				<Link
					to={EDIT_PROFILE_PATH}
					className={`${QUIET_BUTTON} ${ICON_ON_PHONE}`}
					aria-label="Edit profile"
				>
					<PencilSquareIcon className="size-4" aria-hidden />
					<span className="max-sm:hidden">Edit profile</span>
				</Link>
			</>
		)
	if (shell.viewer === "member" && seesPart(shell, "taste"))
		return (
			<>
				<Link
					to={`${profileTabPath(shell.handle, "stats")}#compare`}
					aria-label="Compare tastes"
					className={`${AMBER_BUTTON} ${ICON_ON_PHONE}`}
				>
					<SparklesIcon className="size-4" aria-hidden />
					<span className="max-sm:hidden">Compare tastes</span>
				</Link>
				<ShareButton handle={shell.handle} className={QUIET_BUTTON} compact />
			</>
		)
	return <ShareButton handle={shell.handle} className={QUIET_BUTTON} compact />
}

/** Posters for the stat strip's Wishlist and Lists cells, from the Overview. */
export interface StripPosters {
	wishlist: (string | null)[]
	lists: (string | null)[]
}

function MiniPosters({ paths }: { paths: (string | null)[] }) {
	return (
		<span className="flex -space-x-2" aria-hidden>
			{paths
				.filter((p): p is string => !!p)
				.slice(0, 4)
				.map((p, i) => (
					<img
						key={p}
						src={posterUrl(p, "w92") ?? ""}
						alt=""
						loading="lazy"
						className="h-7 w-5 rounded-sm object-cover ring-1 ring-gray-950"
						style={{ zIndex: 4 - i }}
					/>
				))}
		</span>
	)
}

/** One connected strip: Seen, Scores, Wishlist, Lists, Watched, each linked to its page with a small picture of it. */
export function StatStrip({
	shell,
	posters,
}: { shell: ProfileShell; posters?: StripPosters }) {
	const c = shell.counts
	const see = (part: ProfilePart) => seesPart(shell, part)
	const most = Math.max(1, ...shell.spread)
	const movieShare = c.seen ? c.seenMovies / c.seen : 0
	const cells: {
		key: string
		value: string
		unit?: string
		/** The unit on phones, where the strip is one row. */
		unitShort?: string
		label: string
		to: string
		visual: ReactNode
		show: boolean
	}[] = [
		{
			key: "seen",
			value: count(c.seen),
			label: "Seen",
			to: profileTabPath(shell.handle, "seen"),
			show: see("seen"),
			visual: (
				<span className="flex w-full flex-col gap-1">
					<span
						className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/10"
						aria-hidden
					>
						<span
							className="bg-amber-400"
							style={{ width: `${movieShare * 100}%` }}
						/>
						<span className="flex-1 bg-amber-200/40" />
					</span>
					<span className="text-[11px] text-gray-500">
						{count(c.seenMovies)} movies · {count(c.seen - c.seenMovies)} shows
					</span>
				</span>
			),
		},
		{
			key: "scores",
			value: count(c.rated),
			label: "Scores",
			to: profileTabPath(shell.handle, "scores"),
			show: see("scores"),
			visual: (
				<span className="flex w-full flex-col gap-1">
					<span className="flex h-5 items-end gap-px" aria-hidden>
						{shell.spread.map((n, i) => (
							<span
								// biome-ignore lint/suspicious/noArrayIndexKey: always the ten scores
								key={i}
								className="flex-1 rounded-[1px]"
								style={{
									height: `${Math.max(8, (n / most) * 100)}%`,
									background: vibe(i + 1),
								}}
							/>
						))}
					</span>
					{c.average != null && (
						<span className="text-[11px] text-gray-500">
							average {c.average}
						</span>
					)}
				</span>
			),
		},
		{
			key: "wishlist",
			value: count(c.wishlist),
			label: "Wishlist",
			to: profileTabPath(shell.handle, "wishlist"),
			show: see("wishlist"),
			visual: <MiniPosters paths={posters?.wishlist ?? []} />,
		},
		{
			key: "lists",
			value: count(c.lists),
			label: c.lists === 1 ? "List" : "Lists",
			to: profileTabPath(shell.handle, "lists"),
			show: see("lists"),
			visual: <MiniPosters paths={posters?.lists ?? []} />,
		},
		{
			key: "watched",
			value: count(Math.round(c.hours / 24)),
			unit: "days",
			unitShort: "d",
			label: "Watched",
			to: profileTabPath(shell.handle, "stats"),
			show: see("hours"),
			visual: (
				<span className="text-[11px] text-gray-500">
					about {count(c.hours)} hours · {count(c.episodes)} episodes
				</span>
			),
		},
	]
	const shown = cells.filter((cell) => cell.show)
	if (!shown.length) return null
	return (
		<ul
			className="grid grid-cols-[repeat(var(--n),minmax(0,1fr))] gap-px overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10"
			style={{ "--n": shown.length } as CSSProperties}
		>
			{shown.map((cell) => (
				<li key={cell.key} className="min-w-0">
					<Link
						to={cell.to}
						prefetch="intent"
						className="group flex h-full flex-col gap-1 bg-gray-950/85 px-1.5 py-2 transition-colors min-[400px]:px-2 sm:gap-1.5 hover:bg-gray-900/90 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white sm:px-4 sm:py-3"
					>
						<span className="truncate text-[10px] font-semibold text-gray-400 uppercase group-hover:text-amber-300 min-[400px]:tracking-wide sm:text-[11px]">
							{cell.label}
						</span>
						<span
							className={`${DISPLAY} text-base leading-none whitespace-nowrap text-white tabular-nums min-[400px]:text-lg sm:text-3xl`}
						>
							{cell.value}
							{cell.unit && (
								<span className="ml-0.5 font-sans text-xs font-bold text-gray-400 sm:ml-1">
									<span className="sm:hidden">
										{cell.unitShort ?? cell.unit}
									</span>
									<span className="max-sm:hidden">{cell.unit}</span>
								</span>
							)}
						</span>
						<span className="mt-auto hidden min-h-7 items-end sm:flex">
							{cell.visual}
						</span>
					</Link>
				</li>
			))}
		</ul>
	)
}

/** The full header on Overview. */
function FullHead({
	shell,
	posters,
}: { shell: ProfileShell; posters?: StripPosters }) {
	return (
		<header className="relative isolate overflow-hidden">
			{shell.cover && (
				<img
					src={posterUrl(shell.cover.backdrop, "w1280") ?? ""}
					alt=""
					className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_30%] opacity-25"
				/>
			)}
			<div className="absolute inset-0 -z-10 bg-linear-to-t from-gray-950 via-gray-950/85 to-gray-950/40" />
			<div className={`${WRAP} flex flex-col gap-4 pt-6 pb-5 sm:pt-10`}>
				<div className="flex items-start gap-x-4 sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-3">
					<ProfileAvatar handle={shell.handle} avatar={shell.avatar} />
					<div className="min-w-0 flex-1">
						<h1
							className={`${DISPLAY} text-2xl leading-tight break-words text-white sm:text-4xl`}
						>
							@{shell.handle}
						</h1>
						{shell.since && (
							<p className="text-sm text-gray-400">
								<span className="max-sm:hidden">On GoodWatch since </span>
								<span className="sm:hidden">Since </span>
								{monthYear(shell.since)}
							</p>
						)}
						{shell.bio && (
							<p className="mt-1 max-w-2xl text-sm text-gray-200 sm:text-base">
								{shell.bio}
							</p>
						)}
						{/* Phones: the link logos under the bio; the actions stay beside the name. */}
						<div className="mt-2 empty:hidden sm:hidden">
							<LinkLogos shell={shell} />
						</div>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<div className="max-sm:hidden">
							<LinkLogos shell={shell} />
						</div>
						<Actions shell={shell} />
					</div>
				</div>
				<StatStrip shell={shell} posters={posters} />
			</div>
		</header>
	)
}

/** The head of a page under Overview: who it belongs to, the page's name and a line. */
function CompactHead({
	shell,
	title,
	line,
	right,
}: { shell: ProfileShell; title: string; line?: string; right?: ReactNode }) {
	const home = profileTabPath(shell.handle)
	return (
		<header className={`${WRAP} flex items-center gap-3 pt-6 pb-4`}>
			<Link
				to={home}
				aria-label={`@${shell.handle}'s profile`}
				className="shrink-0"
			>
				<ProfileAvatar handle={shell.handle} avatar={shell.avatar} size="sm" />
			</Link>
			<div className="min-w-0">
				<Link to={home} className="text-sm text-gray-400 hover:text-white">
					@{shell.handle}
				</Link>
				<h1
					className={`${DISPLAY} text-3xl leading-tight text-white md:text-4xl`}
				>
					{title}
				</h1>
				{line && <p className="text-sm text-gray-400">{line}</p>}
			</div>
			{right && <div className="ml-auto shrink-0">{right}</div>}
		</header>
	)
}

const PART_NAMES: Record<ProfilePart, string> = {
	scores: "their scores",
	seen: "what they've seen",
	wishlist: "their Wishlist",
	shows: "their shows",
	lists: "their lists",
	taste: "their taste",
	hours: "their time watched",
	activity: "their activity",
}

/** A profile page: the frame, then the page, or the notice when the viewer may not see the page's part. */
export function ProfileFrame({
	shell,
	tab,
	title,
	line,
	part,
	posters,
	headerRight,
	children,
}: {
	shell: ProfileShell
	tab: ProfileTab
	/** The compact head's right end, such as the page's Share menu. */
	headerRight?: ReactNode
	/** The page's name under the compact head; Overview has the full head. */
	title?: string
	line?: string
	part?: ProfilePart
	posters?: StripPosters
	children: ReactNode
}) {
	const allowed = !part || seesPart(shell, part)
	return (
		<main className="min-h-screen overflow-x-clip text-white">
			{tab === "overview" ? (
				<FullHead shell={shell} posters={posters} />
			) : (
				<CompactHead
					shell={shell}
					title={title ?? ""}
					line={allowed ? line : undefined}
					right={headerRight}
				/>
			)}
			<ProfileTabs shell={shell} active={tab} />
			{allowed ? (
				children
			) : (
				<div className={`${WRAP} pt-8 pb-32`}>
					<HiddenPart
						handle={shell.handle}
						part={part ? PART_NAMES[part] : ""}
						members={
							!!part &&
							shell.visibility[part] === "members" &&
							shell.viewer === "guest"
						}
					/>
				</div>
			)}
		</main>
	)
}
