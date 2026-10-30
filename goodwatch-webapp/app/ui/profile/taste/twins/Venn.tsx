// Two Venn drawings for the comparison's group options (round 19, nav option `venn`):
//   MiniVenn   tabs: a compact header graphic whose three regions and the split marker under them are tab targets.
//   GraphVenn  graph: the Venn with Where you split drawn in the lens, each split pulling toward whoever scored it higher.
import { Link } from "@remix-run/react"
import { DISPLAY } from "~/ui/my-pages/bits"
import {
	Dot,
	GROUPS,
	type GroupId,
	type Plan,
	type Ready,
	SplitLegend,
	VennCircles,
	VennPart,
	splitsOf,
} from "./parts"

export type TabId = GroupId | "splits"

// The drawing's geometry (viewBox 100 x 60): two circles of radius 30 at x 30 and 70 meet at x 50, y 30 +/- 22.36.
const TOP = "50 7.64"
const BOTTOM = "50 52.36"
const REGION_PATH: Record<GroupId, string> = {
	picks: `M${TOP} A30 30 0 1 0 ${BOTTOM} A30 30 0 0 1 ${TOP} Z`,
	both: `M${TOP} A30 30 0 0 1 ${BOTTOM} A30 30 0 0 1 ${TOP} Z`,
	only: `M${TOP} A30 30 0 1 1 ${BOTTOM} A30 30 0 0 0 ${TOP} Z`,
}
/** Each region's middle, as a share of the drawing's width. */
const REGION_X: Record<GroupId, string> = {
	picks: "20%",
	both: "50%",
	only: "80%",
}
const SHORT: Record<GroupId, string> = {
	picks: "for you",
	both: "both",
	only: "only you",
}

export function MiniVenn({
	plan,
	splits,
	tab,
	onPick,
	controls,
}: {
	plan: Plan
	splits: number
	tab: TabId
	onPick: (t: TabId) => void
	/** The tab panel's id. */
	controls: string
}) {
	return (
		<div className="flex flex-col items-center gap-2">
			<div className="relative aspect-[100/60] w-[19rem] sm:w-[22rem]">
				{/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative, aria-hidden; the buttons carry the meaning */}
				<svg
					viewBox="0 0 100 60"
					className="absolute inset-0 h-full w-full overflow-visible"
					aria-hidden
				>
					{GROUPS.map((g) => (
						<path
							key={g.id}
							d={REGION_PATH[g.id]}
							fill={g.color}
							className="transition-[fill-opacity] duration-300"
							fillOpacity={tab === g.id ? 0.22 : 0.04}
						/>
					))}
					<circle
						cx="30"
						cy="30"
						r="30"
						fill="none"
						stroke="#fbbf24"
						strokeOpacity=".55"
						strokeWidth=".4"
					/>
					<circle
						cx="70"
						cy="30"
						r="30"
						fill="none"
						stroke="#ffffff"
						strokeOpacity=".45"
						strokeWidth=".4"
					/>
				</svg>
				{GROUPS.map((g) => (
					<button
						key={g.id}
						type="button"
						tabIndex={-1}
						aria-controls={controls}
						aria-label={`${g.name}, ${plan.counts[g.id]}`}
						onClick={() => onPick(g.id)}
						className="group/mini absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-xl px-1.5 py-1"
						style={{ left: REGION_X[g.id] }}
					>
						<span
							className={`${DISPLAY} text-2xl leading-none tabular-nums transition-colors sm:text-3xl ${tab === g.id ? g.tone : "text-gray-400 group-hover/mini:text-white"}`}
						>
							{plan.counts[g.id]}
						</span>
						<span
							className={`text-[10px] font-semibold ${tab === g.id ? "text-gray-200" : "text-gray-500"}`}
						>
							{SHORT[g.id]}
						</span>
					</button>
				))}
			</div>
			{/* The split marker: a little dumbbell between the two circles' colors. */}
			<button
				type="button"
				tabIndex={-1}
				aria-controls={controls}
				aria-label={`Where you split, ${splits}`}
				onClick={() => onPick("splits")}
				className="group/mini inline-flex items-center gap-2 rounded-full px-2 py-1"
			>
				<span className="relative flex h-3 w-12 items-center" aria-hidden>
					<span
						className={`absolute inset-x-1 h-0.5 rounded-full transition-colors ${tab === "splits" ? "bg-rose-400" : "bg-rose-400/40"}`}
					/>
					<span className="absolute left-0 size-2.5 rounded-full bg-amber-400" />
					<span className="absolute right-0 size-2.5 rounded-full bg-white" />
				</span>
				<span
					className={`text-xs font-semibold tabular-nums ${tab === "splits" ? "text-rose-300" : "text-gray-400 group-hover/mini:text-white"}`}
				>
					{splits} splits
				</span>
			</button>
		</div>
	)
}

/** The tab row under the mini Venn. */
export function TabRow({
	plan,
	splits,
	tab,
	onPick,
	controls,
}: {
	plan: Plan
	splits: number
	tab: TabId
	onPick: (t: TabId) => void
	controls: string
}) {
	const tabs: { id: TabId; name: string; n: number; bar: string }[] = [
		...GROUPS.map((g) => ({
			id: g.id as TabId,
			name: g.name,
			n: plan.counts[g.id],
			bar: g.color,
		})),
		{ id: "splits", name: "Where you split", n: splits, bar: "#fb7185" },
	]
	return (
		<div
			role="tablist"
			aria-label="Compare"
			className="-mx-5 flex overflow-x-auto px-5 [scrollbar-width:none] sm:-mx-8 sm:justify-center sm:px-8"
		>
			{tabs.map((t) => {
				const on = tab === t.id
				return (
					<button
						key={t.id}
						type="button"
						role="tab"
						aria-selected={on}
						aria-controls={controls}
						onClick={() => onPick(t.id)}
						className={`relative shrink-0 px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors sm:px-4 ${on ? "text-white" : "text-gray-400 hover:text-gray-200"}`}
					>
						{t.name}
						<span
							className={`ml-1.5 text-xs tabular-nums ${on ? "text-gray-300" : "text-gray-600"}`}
						>
							{t.n}
						</span>
						<span
							aria-hidden
							className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full transition-opacity duration-200 sm:inset-x-4 ${on ? "opacity-100" : "opacity-0"}`}
							style={{ background: t.bar }}
						/>
					</button>
				)
			})}
		</div>
	)
}

/** Splits drawn in the graph's lens. */
export const LENS_SPLITS = 6

/**
 * The graph: the two circles with Picks for you and Only you love on the outer sides, and You both love over the
 * lens. Under it, in the lens, the widest splits: each title sits in the middle and its bar pulls toward the circle of
 * whoever scored it higher, as long as the gap, with both scores on the bar.
 */
export function GraphVenn({
	plan,
	c,
	handle,
	active,
	onOpen,
}: {
	plan: Plan
	c: Ready
	handle: string
	active: GroupId | null
	onOpen: (g: GroupId) => void
}) {
	const part = (
		i: 0 | 1 | 2,
		titles: Ready["overlap"]["both"],
		label: string,
	) => {
		const g = GROUPS[i]
		return (
			<VennPart
				group={g}
				titles={titles}
				count={plan.counts[g.id]}
				size="sm"
				label={label}
				onOpen={onOpen}
				active={active === g.id}
				dim={active != null && active !== g.id}
				openLabel="Showing below"
			/>
		)
	}
	const rows = splitsOf(c).slice(0, LENS_SPLITS)
	return (
		<div className="relative overflow-hidden p-5 sm:p-8">
			<VennCircles id="gv" />
			<div className="relative grid gap-8 md:min-h-[26rem] md:grid-cols-[1fr_1.4fr_1fr] md:items-center md:gap-3">
				{part(0, plan.them, `Picks for you from @${handle}`)}
				<div className="flex flex-col items-center gap-5">
					{part(1, plan.both, "Loved by you both")}
					{rows.length > 0 && (
						<div className="w-full max-w-xl">
							<div className="mb-2 flex flex-col items-center gap-1">
								<p className="text-[11px] font-bold tracking-wide text-rose-300 uppercase">
									Where you split
								</p>
								<SplitLegend handle={handle} />
							</div>
							<ul className="flex flex-col gap-1.5">
								{rows.map((r) => (
									<Tug key={r.key} r={r} handle={handle} />
								))}
							</ul>
						</div>
					)}
				</div>
				{part(2, plan.you, "Loved by you")}
			</div>
		</div>
	)
}

/** One split in the lens: the title in the middle, the bar on the side of whoever scored it higher. */
function Tug({ r, handle }: { r: Ready["shared"][number]; handle: string }) {
	const gap = Math.abs(r.theirs - r.yours)
	const len = (gap / 9) * 100
	const theirsHigher = r.theirs > r.yours
	const bar = (
		<span className="relative block h-6">
			<span className="absolute inset-x-0 top-1/2 h-px bg-white/[0.07]" />
			<span
				className={`absolute top-1/2 h-1 -translate-y-1/2 rounded-full ${theirsHigher ? "right-0 bg-amber-400/60" : "left-0 bg-white/50"}`}
				style={{ width: `${len}%` }}
			/>
			{theirsHigher ? (
				<>
					<Dot at={`${100 - len}%`} score={r.theirs} ring="ring-amber-400" />
					<Dot at="100%" score={r.yours} ring="ring-white" />
				</>
			) : (
				<>
					<Dot at="0%" score={r.theirs} ring="ring-amber-400" />
					<Dot at={`${len}%`} score={r.yours} ring="ring-white" />
				</>
			)}
		</span>
	)
	return (
		<li
			className="grid grid-cols-2 items-center sm:grid-cols-[minmax(0,1fr)_minmax(0,10rem)_minmax(0,1fr)] sm:gap-4"
			aria-label={`${r.title}: @${handle} ${r.theirs}, you ${r.yours}`}
		>
			<span className="pl-3 max-sm:border-r max-sm:border-white/10 max-sm:pr-3">
				{theirsHigher && bar}
			</span>
			<Link
				to={r.href}
				className="truncate text-xs font-semibold text-gray-200 hover:text-white max-sm:order-first max-sm:col-span-2 max-sm:text-center sm:text-center"
			>
				{r.title}
			</Link>
			<span className="pr-3 max-sm:pl-3">{!theirsHigher && bar}</span>
		</li>
	)
}
