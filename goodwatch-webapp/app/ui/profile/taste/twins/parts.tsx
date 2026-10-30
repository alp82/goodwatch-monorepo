// The comparison's shared pieces: the Venn's parts (the board is in Venn.tsx), Where you split, the picks panel and small
// helpers. Each panel takes `frame`, the classes of its surface (a boxed PANEL by default); the strip (Strip.tsx) passes
// "" and separates them itself.
import { ArrowRightIcon, SparklesIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { animate } from "framer-motion"
import { useEffect, useState } from "react"
import { RATE_FALLBACK_PATH } from "~/domain/member-paths"
import type { ProfileTitle } from "~/domain/profile"
import type { MemberCompare } from "~/domain/profile-taste"
import { DISPLAY } from "~/ui/my-pages/bits"
import { PANEL_CARD_SIZES, ProfileCard } from "../../ProfileCard"
import { AMBER_BUTTON, TILE, posterUrl, vibe } from "../../parts"
import { PANEL } from "../parts"

export type Ready = Extract<MemberCompare, { status: "ready" }>

interface PanelProps {
	handle: string
	c: Ready
	/** The panel's surface classes; "" drops the box. */
	frame?: string
}

export function CountUp({ to, still }: { to: number; still: boolean }) {
	const [n, setN] = useState(to)
	useEffect(() => {
		if (still) {
			setN(to)
			return
		}
		const run = animate(0, to, {
			duration: 1.1,
			ease: [0.16, 1, 0.3, 1],
			onUpdate: (v) => setN(Math.round(v)),
		})
		return () => run.stop()
	}, [to, still])
	return <>{n}</>
}

/** Too few liked titles on one side to compare: the visitor's (rate more) or the owner's (nothing to do). */
export function ThinMatch({
	compare,
	handle,
}: { compare: Extract<MemberCompare, { status: "thin" }>; handle: string }) {
	if (compare.side === "them")
		return (
			<div className={`${TILE} flex flex-wrap items-center gap-4 p-4 sm:p-5`}>
				<SparklesIcon className="size-7 shrink-0 text-gray-500" aria-hidden />
				<p className="min-w-[12rem] flex-1 text-gray-300">
					<b className="text-white">
						@{handle} hasn't rated enough yet to compare.
					</b>
				</p>
			</div>
		)
	return (
		<div className={`${TILE} flex flex-wrap items-center gap-4 p-4 sm:p-5`}>
			<SparklesIcon className="size-7 shrink-0 text-amber-400" aria-hidden />
			<p className="min-w-[12rem] flex-1 text-gray-300">
				<b className="text-white">Rate 5 titles you love to see your match.</b>{" "}
				You have {compare.liked} so far.
			</p>
			<Link to={RATE_FALLBACK_PATH} className={AMBER_BUTTON}>
				Rate titles
				<ArrowRightIcon className="size-4" aria-hidden />
			</Link>
		</div>
	)
}

// ---------- The overlap ----------

export function Fan({
	titles,
	size,
	label,
	linked = true,
}: {
	titles: ProfileTitle[]
	size: "sm" | "lg"
	label: string
	/** Posters link to their title pages; off when the whole fan is a button. */
	linked?: boolean
}) {
	const n = titles.length
	// Small posters, so the Venn takes less height.
	const w = size === "lg" ? "w-16 md:w-[4.75rem]" : "w-11 md:w-14"
	return (
		<ul className="flex justify-center" aria-label={label}>
			{titles.map((t, i) => {
				const mid = (n - 1) / 2
				const turn = (i - mid) * (size === "lg" ? 7 : 9)
				const lift = Math.abs(i - mid) * (size === "lg" ? 6 : 4)
				const poster = t.poster ? (
					<img
						src={posterUrl(t.poster) ?? ""}
						alt={t.title}
						loading="lazy"
						className="aspect-[2/3] w-full rounded-lg object-cover shadow-xl ring-2 ring-gray-950"
					/>
				) : (
					<span className="block aspect-[2/3] w-full rounded-lg bg-white/10" />
				)
				return (
					<li
						key={t.key}
						data-title-key={t.key}
						className={`${w} shrink-0 ${i ? (size === "lg" ? "-ml-5 md:-ml-6" : "-ml-4 md:-ml-5") : ""}`}
						style={{
							transform: `translateY(${lift}px) rotate(${turn}deg)`,
							zIndex: 10 - Math.round(Math.abs(i - mid)),
						}}
					>
						{linked ? (
							<Link to={t.href} title={t.title} className="block">
								{poster}
							</Link>
						) : (
							<span className="block">{poster}</span>
						)}
					</li>
				)
			})}
		</ul>
	)
}

/** How many posters a fan shows, and how many the picks panel's row shows. */
const FAN_MAX = 4

/** The three groups of the Venn. */
export type GroupId = "picks" | "both" | "only"

type ThemTitle = Ready["overlap"]["onlyThem"][number]
type YouTitle = Ready["overlap"]["onlyYou"][number]

/**
 * What each part of the expanded comparison shows, so no title shows twice.
 * Their 9s and 10s you haven't rated (`onlyThem`, best fit first) are "Picks for you"; the picks panel keeps only your
 * loved titles on their wishlist, and the "Only you love" fan skips them. `groups` are the full lists the three parts
 * open into.
 */
export function planCompare(handle: string, c: Ready) {
	const o = c.overlap
	const wished = o.onlyYou.filter((x) => x.wished)
	const forThem = wished.slice(0, FAN_MAX)
	const taken = new Set(forThem.map((t) => t.key))
	return {
		them: o.onlyThem.slice(0, FAN_MAX),
		you: o.onlyYou.filter((t) => !taken.has(t.key)).slice(0, FAN_MAX),
		both: o.both.slice(0, 3),
		forThem,
		hasPicks: forThem.length > 0,
		groups: { picks: o.onlyThem, both: o.both, only: o.onlyYou },
		counts: { picks: o.onlyThemCount, both: o.bothCount, only: o.onlyYouCount },
		handle,
	}
}

export type Plan = ReturnType<typeof planCompare>

/** The groups' names, colors and count lines, in the Venn's order. */
export const GROUPS: {
	id: GroupId
	name: string
	tone: string
	/** The color behind the group: theirs amber, both white, yours gray. */
	color: string
	count: (n: number) => string
}[] = [
	{
		id: "picks",
		name: "Picks for you",
		tone: "text-amber-300",
		color: "#fbbf24",
		count: (n) => `From ${n} of their 9s and 10s, best fit first`,
	},
	{
		id: "both",
		name: "You both love",
		tone: "text-white",
		color: "#ffffff",
		count: (n) => `${n} titles you both scored 8 or more`,
	},
	{
		id: "only",
		name: "Only you love",
		tone: "text-gray-200",
		color: "#d1d5db",
		count: (n) => `${n} of your 8s and up they haven't rated`,
	},
]

/**
 * One part of the Venn, a button that opens the group's full list below. While it is open, its posters give way to the
 * group's count (the list shows them), and "See all" turns into `openLabel`.
 */
export function VennPart({
	group,
	titles,
	count,
	size,
	label,
	onOpen,
	active,
	dim,
	openLabel,
	controls,
	phoneCount = true,
}: {
	group: (typeof GROUPS)[number]
	titles: ProfileTitle[]
	count: number
	size: "sm" | "lg"
	label: string
	onOpen: (g: GroupId) => void
	active: boolean
	dim: boolean
	openLabel: string
	/** The id of the view the part opens. */
	controls?: string
	/** Shows the count line on phones too (the parts in the circles skip it). */
	phoneCount?: boolean
}) {
	return (
		<button
			type="button"
			aria-pressed={active}
			aria-controls={controls}
			onClick={() => onOpen(group.id)}
			className={`group/part relative flex flex-col items-center gap-2 rounded-2xl px-2 py-2 transition-opacity duration-300 focus-visible:outline-2 focus-visible:outline-amber-400 ${dim ? "opacity-55 hover:opacity-90" : ""}`}
		>
			{/* The active part's glow, in the group's color. */}
			<span
				aria-hidden
				className={`pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300 ${active ? "opacity-100" : "opacity-0"}`}
				style={{
					background: `radial-gradient(50% 50% at 50% 55%, color-mix(in srgb, ${group.color} 14%, transparent), transparent 100%)`,
				}}
			/>
			<span className="relative text-center">
				<span
					className={`block text-[10px] font-bold tracking-wide uppercase md:text-[11px] ${group.tone}`}
				>
					{group.name}
				</span>
				<span
					className={`block max-w-[15rem] text-[11px] text-gray-500 md:text-xs ${phoneCount ? "" : "max-md:hidden"}`}
				>
					{group.count(count)}
				</span>
			</span>
			<span className="relative block">
				<span
					className={`block transition-[opacity,transform] duration-300 group-hover/part:-translate-y-1 ${active ? "opacity-0" : "opacity-100"}`}
				>
					<Fan titles={titles} size={size} label={label} linked={false} />
				</span>
				<span
					aria-hidden={!active}
					className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-300 ${active ? "opacity-100" : "opacity-0"}`}
				>
					<span
						className={`${DISPLAY} text-4xl leading-none tabular-nums md:text-5xl ${group.tone}`}
					>
						{count}
					</span>
				</span>
			</span>
			<span
				className={`relative inline-flex items-center gap-1 text-[11px] font-semibold md:text-xs ${active ? "text-amber-400" : "text-gray-400 group-hover/part:text-white"}`}
			>
				{active ? openLabel : `See all ${count}`}
				<ArrowRightIcon
					className={`size-3.5 transition-transform ${active ? "rotate-90" : ""}`}
					aria-hidden
				/>
			</span>
		</button>
	)
}

// ---------- Where you split ----------

/** A split is a title you both rated with scores 4 or more apart. */
export const SPLIT_GAP = 4
/** Split rows shown first, then each "Show 20 more" adds a batch. */
export const SPLITS_FIRST = 6
const SPLITS_BATCH = 20

type SplitRow = Ready["shared"][number]
const gapOf = (r: SplitRow) => Math.abs(r.yours - r.theirs)

/** Titles you both rated 4 or more points apart, widest gap first. */
export const splitsOf = (c: Ready) =>
	c.shared
		.filter((r) => gapOf(r) >= SPLIT_GAP)
		.sort((a, b) => gapOf(b) - gapOf(a))

/** The 1 to 10 scale as a share of the track. */
export const at = (score: number) => `${((score - 1) / 9) * 100}%`

export function Splits({ handle, c, frame = PANEL }: PanelProps) {
	const rest = splitsOf(c)
	const [shown, setShown] = useState(SPLITS_FIRST)
	const rows = rest.slice(0, shown)
	const left = rest.length - rows.length
	if (!rest.length) return null
	return (
		<div className={`${frame} flex flex-col gap-3 p-5 sm:p-8`}>
			<div className="flex items-baseline justify-between gap-3">
				<p className="font-bold text-white">Where you split</p>
				<SplitLegend handle={handle} />
			</div>
			{rows.length > 0 && (
				<ul className="grid gap-y-2 sm:grid-cols-[2.25rem_fit-content(22rem)_minmax(10rem,1fr)] sm:gap-x-4 sm:gap-y-1">
					{rows.map((r) => (
						<SplitLine key={r.key} r={r} handle={handle} />
					))}
				</ul>
			)}
			{left > 0 && (
				<button
					type="button"
					onClick={() => setShown(shown + SPLITS_BATCH)}
					className="self-start text-sm font-semibold text-amber-500 hover:text-amber-400"
				>
					Show {Math.min(SPLITS_BATCH, left)} more
				</button>
			)}
		</div>
	)
}

/** Tiny legend: the dots' rings say whose score is whose. */
export function SplitLegend({ handle }: { handle: string }) {
	return (
		<p className="flex shrink-0 items-center gap-2.5 text-[11px] text-gray-500">
			<span className="inline-flex items-center gap-1">
				<span className="size-1.5 rounded-full bg-amber-400" aria-hidden />@
				{handle}
			</span>
			<span className="inline-flex items-center gap-1">
				<span className="size-1.5 rounded-full bg-white" aria-hidden />
				you
			</span>
		</p>
	)
}

/** One split: poster, title and the dumbbell track. Phones put the track under the title. */
function SplitLine({ r, handle }: { r: SplitRow; handle: string }) {
	const lo = Math.min(r.yours, r.theirs)
	const hi = Math.max(r.yours, r.theirs)
	return (
		<li className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 sm:col-span-3 sm:grid-cols-subgrid sm:gap-x-4">
			<span className="block w-8 max-sm:row-span-2 sm:w-9">
				{r.poster && (
					<img
						src={posterUrl(r.poster, "w92") ?? ""}
						alt=""
						loading="lazy"
						className="aspect-[2/3] w-full rounded object-cover"
					/>
				)}
			</span>
			<Link
				to={r.href}
				className="truncate text-sm font-semibold text-gray-200 hover:text-white"
			>
				{r.title}
			</Link>
			<span
				className="relative mx-3 h-7 sm:h-9"
				aria-label={`@${handle} ${r.theirs}, you ${r.yours}`}
			>
				<span className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
				<span
					className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-rose-400/70"
					style={{ left: at(lo), width: `${((hi - lo) / 9) * 100}%` }}
				/>
				<Dot at={at(r.theirs)} score={r.theirs} ring="ring-amber-400" />
				<Dot at={at(r.yours)} score={r.yours} ring="ring-white" />
			</span>
		</li>
	)
}

export function Dot({
	at,
	score,
	ring,
}: { at: string; score: number; ring: string }) {
	return (
		<span
			className={`absolute top-1/2 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[11px] font-black text-gray-950 ring-2 ${ring}`}
			style={{ left: at, background: vibe(score) }}
		>
			{score}
		</span>
	)
}

// ---------- Picks for each other ----------

export function Picks({
	handle,
	plan,
	frame = PANEL,
}: Omit<PanelProps, "c"> & { plan: Plan }) {
	const { forThem } = plan
	if (!forThem.length) return null
	return (
		<div className={`${frame} flex flex-col gap-4 p-5 sm:p-8`}>
			<p className="font-bold text-white">Picks for each other</p>
			<PickRow
				title={`You loved these; @${handle} wants to see them`}
				items={forThem.map((t) => ({ t, note: `You scored it ${t.yours}` }))}
			/>
		</div>
	)
}

export function PickRow({
	title,
	items,
}: { title: string; items: { t: ProfileTitle; note: string }[] }) {
	if (!items.length) return null
	return (
		<div>
			<p className="mb-2 text-xs font-semibold text-gray-300">{title}</p>
			<ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
				{items.map(({ t, note }, i) => (
					<li
						key={t.key}
						className={`flex min-w-0 flex-col gap-1 ${i === 3 ? "max-sm:hidden" : ""}`}
					>
						<ProfileCard title={t} posterSizes={PANEL_CARD_SIZES} />
						<span className="block truncate text-[11px] text-gray-500">
							{note}
						</span>
					</li>
				))}
			</ul>
		</div>
	)
}
