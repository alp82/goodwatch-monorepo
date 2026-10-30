// The comparison's Venn: the two circles with the three groups, a small clickable visual for Where you split,
// and the tab row under them. A Venn part, the split visual and a tab all pick the same view below (Panels.tsx).
// The split visual is a small dumbbell (an amber and a white dot joined by a line) with the count, under the lens.
// Phones keep You both love above the circles and put the two other groups in them.
import { motion } from "framer-motion"
import { type CSSProperties, useEffect, useRef } from "react"
import { SUBNAV_MARK, subnavItem } from "~/ui/navigation/bar-layers"
import { GROUPS, type GroupId, type Plan, VennPart } from "./parts"

export type TabId = GroupId | "splits"

/** A drawing's geometry in its own units: the box, the circles' middle line, radius, and the two centers. */
type Geo = { w: number; h: number; cy: number; r: number; a: number; b: number }

/** Wide screens: the circles fill the board's height. */
const WIDE: Geo = { w: 1000, h: 440, cy: 200, r: 190, a: 375, b: 625 }
/** Phones: the circles under You both love, holding the two other groups. */
const PHONE: Geo = { w: 360, h: 240, cy: 105, r: 100, a: 100, b: 260 }

const mid = (g: Geo) => g.w / 2

/** A rectangle in the drawing's units, placed in the box by percentages. */
function place(
	g: Geo,
	x: number,
	y: number,
	w: number,
	h: number,
): CSSProperties {
	return {
		left: `${(x / g.w) * 100}%`,
		top: `${(y / g.h) * 100}%`,
		width: `${(w / g.w) * 100}%`,
		height: `${(h / g.h) * 100}%`,
	}
}

export interface SplitInfo {
	/** How many titles you split on. */
	n: number
}

/** On phones the circles box and the two lower cells share one width, so the cells sit in the circles. */
const PHONE_BOX = "relative mx-auto aspect-[360/240] w-full max-w-[22rem]"
const PHONE_CELL =
	"max-md:row-start-2 max-md:aspect-[180/240] max-md:items-start max-md:pt-[12%]"

/** The Venn board: circles, the three parts and the split visual. */
export function VennBoard({
	handle,
	plan,
	splits,
	tab,
	onPick,
	controls,
}: {
	handle: string
	plan: Plan
	splits: SplitInfo
	tab: TabId
	onPick: (t: TabId) => void
	controls: string
}) {
	const part = (i: 0 | 1 | 2, label: string, className: string) => {
		const g = GROUPS[i]
		const titles = [plan.them, plan.both, plan.you][i]
		return (
			<div className={`flex justify-center ${className}`}>
				<VennPart
					group={g}
					titles={titles}
					count={plan.counts[g.id]}
					size={i === 1 ? "lg" : "sm"}
					label={label}
					onOpen={(id) => onPick(tab === id ? "splits" : id)}
					active={tab === g.id}
					dim={tab !== "splits" && tab !== g.id}
					openLabel="Showing below"
					controls={controls}
					phoneCount={i === 1}
				/>
			</div>
		)
	}
	const vis = (g: Geo) => (
		<SplitVis
			geo={g}
			splits={splits}
			on={tab === "splits"}
			onPick={() => onPick("splits")}
			controls={controls}
		/>
	)
	return (
		<div className="relative pt-4 md:h-[20rem] md:pt-0">
			{/* Wide screens: the circles box fills the board's height, centered. */}
			<div className="pointer-events-none absolute top-0 left-1/2 hidden aspect-[1000/440] h-full -translate-x-1/2 md:block">
				<Circles geo={WIDE} id="vw" />
			</div>
			{/* Phones: the circles box sits under You both love, behind the two other parts. */}
			<div className="pointer-events-none absolute inset-x-0 bottom-0 md:hidden">
				<div className={PHONE_BOX}>
					<Circles geo={PHONE} id="vp" />
				</div>
			</div>
			<div className="relative mx-auto grid max-w-[22rem] grid-cols-2 md:h-full md:max-w-[52rem] md:grid-cols-[1fr_0.9fr_1fr] md:items-center md:pb-14">
				{part(0, `Picks for you from @${handle}`, PHONE_CELL)}
				{part(
					1,
					"Loved by you both",
					"max-md:col-span-2 max-md:row-start-1 max-md:pb-1",
				)}
				{part(2, "Loved by you", PHONE_CELL)}
			</div>
			{/* The split visual, over the parts' layer so it stays clickable. */}
			<div className="pointer-events-none absolute top-0 left-1/2 z-10 hidden aspect-[1000/440] h-full -translate-x-1/2 md:block">
				{vis(WIDE)}
			</div>
			<div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 md:hidden">
				<div className={PHONE_BOX}>{vis(PHONE)}</div>
			</div>
		</div>
	)
}

function Circles({ geo: g, id }: { geo: Geo; id: string }) {
	return (
		// biome-ignore lint/a11y/noSvgWithoutTitle: decorative, aria-hidden; the parts carry the meaning
		<svg
			viewBox={`0 0 ${g.w} ${g.h}`}
			className="absolute inset-0 h-full w-full overflow-visible"
			aria-hidden
		>
			<defs>
				<radialGradient id={`${id}-them`} cx="40%" cy="50%" r="60%">
					<stop offset="0" stopColor="#fbbf24" stopOpacity=".12" />
					<stop offset="1" stopColor="#fbbf24" stopOpacity=".02" />
				</radialGradient>
				<radialGradient id={`${id}-you`} cx="60%" cy="50%" r="60%">
					<stop offset="0" stopColor="#ffffff" stopOpacity=".1" />
					<stop offset="1" stopColor="#ffffff" stopOpacity=".02" />
				</radialGradient>
			</defs>
			<circle
				cx={g.a}
				cy={g.cy}
				r={g.r}
				fill={`url(#${id}-them)`}
				stroke="#fbbf24"
				strokeOpacity=".45"
				strokeWidth="1.5"
				vectorEffect="non-scaling-stroke"
			/>
			<circle
				cx={g.b}
				cy={g.cy}
				r={g.r}
				fill={`url(#${id}-you)`}
				stroke="#ffffff"
				strokeOpacity=".4"
				strokeWidth="1.5"
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	)
}

// ---------- The split visual ----------

/** The visual's button: no motion but opacity; hover brightens, a focus ring shows. */
const VIS_BUTTON =
	"group/sv pointer-events-auto absolute rounded-full outline-none focus-visible:ring-2 focus-visible:ring-amber-400"

/** Dims the visual when another view is open; hover or focus brings it back. */
const shade = (on: boolean) =>
	`transition-opacity duration-200 ${on ? "opacity-100" : "opacity-80 group-hover/sv:opacity-100 group-focus-visible/sv:opacity-100"}`

function SplitVis({
	geo: g,
	splits,
	on,
	onPick,
	controls,
}: {
	geo: Geo
	splits: SplitInfo
	on: boolean
	onPick: () => void
	controls: string
}) {
	if (!splits.n) return null
	const phone = g === PHONE
	const common = {
		type: "button" as const,
		"aria-pressed": on,
		"aria-controls": controls,
		"aria-label": `Where you split, ${splits.n}`,
		onClick: onPick,
	}
	const count = () => (
		<span
			className={`text-[12px] font-semibold whitespace-nowrap tabular-nums transition-colors ${on ? "text-rose-200" : "text-gray-400 group-hover/sv:text-white"}`}
		>
			{splits.n} {splits.n === 1 ? "split" : "splits"}
		</span>
	)
	const m = mid(g)
	const bottom = g.cy + g.r

	// Under the lens, between the circles.
	const boxW = phone ? 108 : 160
	const boxH = phone ? 26 : 34
	const cyGlyph = phone ? bottom - 4 : bottom - 16
	return (
		<button
			{...common}
			className={`${VIS_BUTTON} flex items-center justify-center gap-1.5 transition-colors ${on ? "bg-white/[0.06] ring-1 ring-rose-400/30" : "hover:bg-white/[0.04]"}`}
			style={place(g, m - boxW / 2, cyGlyph - boxH / 2, boxW, boxH)}
		>
			<span
				className={`relative flex h-3 w-9 items-center ${shade(on)}`}
				aria-hidden
			>
				<span
					className={`absolute inset-x-1 h-[3px] rounded-full ${on ? "bg-rose-400" : "bg-rose-400/85"}`}
				/>
				<span className="absolute left-0 size-2.5 rounded-full bg-amber-400" />
				<span className="absolute right-0 size-2.5 rounded-full bg-white" />
			</span>
			{count()}
		</button>
	)
}

// ---------- The tab row ----------

/** The in-card tab row under the Venn, in the in-page nav's look (an amber dot by the current tab). */
export function TabRow({
	plan,
	splits,
	tab,
	onPick,
	controls,
	layoutId,
}: {
	plan: Plan
	splits: number
	tab: TabId
	onPick: (t: TabId) => void
	controls: string
	layoutId: string
}) {
	// Phones scroll the row: keep the current tab in view.
	const row = useRef<HTMLDivElement>(null)
	const first = useRef(true)
	useEffect(() => {
		const el = row.current
		const on = el?.querySelector<HTMLElement>("[aria-selected=true]")
		if (!el || !on) return
		const left = on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2
		el.scrollTo({ left, behavior: first.current ? "auto" : "smooth" })
		first.current = false
	}, [tab])
	const tabs: { id: TabId; name: string; n: number }[] = [
		...GROUPS.map((g) => ({
			id: g.id as TabId,
			name: g.name,
			n: plan.counts[g.id],
		})),
		{ id: "splits", name: "Where you split", n: splits },
	]
	return (
		<div
			ref={row}
			role="tablist"
			aria-label="Compare"
			className="flex h-11 overflow-x-auto px-3 [scrollbar-width:none] max-md:[mask-image:linear-gradient(90deg,transparent,#000_1.25rem,#000_calc(100%-1.25rem),transparent)] sm:px-6 md:justify-center"
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
						className={`${subnavItem(on)} shrink-0 whitespace-nowrap rounded-md outline-none focus-visible:ring-2 focus-visible:ring-amber-400`}
					>
						{on && (
							<motion.span
								layoutId={layoutId}
								aria-hidden
								transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
								className={SUBNAV_MARK}
							/>
						)}
						<span className="relative">{t.name}</span>
						<span
							className={`relative text-[11px] font-normal tabular-nums ${on ? "text-gray-400" : "text-gray-500"}`}
						>
							{t.n}
						</span>
					</button>
				)
			})}
		</div>
	)
}
