// The moods lattice without its cards: every mood keeps one cell on two
// directions (left lighter, right darker, top calmer, bottom more intense), the dials above it, amber marks on the
// axes. Every card gets the same state: `c` is how close the mood is
// to what is pointed at or dialed (1 the closest, 0 the farthest, null at rest), `focus` is the one mood that leads.
import { Link } from "@remix-run/react"
import { type ComponentType, useState } from "react"
import { CAPTION } from "~/ui/eyebrow"
import { WRAP } from "~/ui/browse/index"
import { FOCUS } from "~/ui/browse/motion"
import { Head } from "~/ui/browse/dials/Head"
import { TunerRow, tunedLine, useTuner } from "~/ui/browse/dials/Tuner"
import type { DialSpec, Settings } from "~/domain/browse/tune"
import type { MoodCard, MoodsData } from "~/server/browse/moods.server"

export interface MoodCardProps {
	mood: MoodCard
	/** 1 the closest to what is pointed at or dialed, 0 the farthest; null at rest (nothing pointed, no dial set). */
	c: number | null
	/** The pointed mood, or the best fit for the dials. */
	focus: boolean
	/**
	 * how well the mood fits the dials alone (1 best, 0 worst; null with no dial set). Unlike `c` it never
	 * changes while you point at moods, so a card can show fit and pointing separately.
	 */
	tuned?: number | null
	/** the mood the pointer or keyboard is on (not the dials' best fit). */
	pointed?: boolean
	/** Lattice coordinates: row 0 is the calmest, col 0 the lightest. */
	row: number
	col: number
	size: "s" | "m"
}
export type MoodCardView = ComponentType<MoodCardProps>

/** One cell per mood, no empty cells: columns from lightest to darkest, each from calmest to most intense. */
function lattice(moods: MoodCard[], cols: number) {
	const n = moods.length
	const byTone = [...moods].sort((a, b) => a.tone - b.tone || a.pace - b.pace)
	const cells: { mood: MoodCard; row: number; col: number }[] = []
	for (let c = 0; c < cols; c++) {
		byTone
			.slice(Math.round((c * n) / cols), Math.round(((c + 1) * n) / cols))
			.sort((a, b) => a.pace - b.pace)
			.forEach((mood, row) => cells.push({ mood, row, col: c }))
	}
	return cells
}

/** Spread a cost per mood over 0-1: the nearest mood is 1, the farthest 0. */
function spread(cost: Map<string, number>) {
	const values = [...cost.values()]
	const lo = Math.min(...values)
	const hi = Math.max(...values)
	return new Map(
		[...cost].map(([slug, c]) => [slug, hi > lo ? 1 - (c - lo) / (hi - lo) : 1] as const),
	)
}

function fits(moods: MoodCard[], dials: DialSpec[], settings: Settings) {
	const active = dials.filter((d) => settings[d.id] != null)
	if (!active.length) return null
	return spread(
		new Map(
			moods.map((m) => [
				m.place.slug,
				active.reduce(
					(sum, d) => sum + Math.abs((m.s[d.col] ?? 0.5) - (settings[d.id] as number)),
					0,
				) / active.length,
			]),
		),
	)
}

function near(moods: MoodCard[], dials: DialSpec[], slug: string) {
	const at = moods.find((m) => m.place.slug === slug)
	if (!at) return null
	return spread(
		new Map(
			moods.map((m) => [
				m.place.slug,
				Math.sqrt(
					dials.reduce((sum, d) => sum + ((m.s[d.col] ?? 0.5) - (at.s[d.col] ?? 0.5)) ** 2, 0),
				),
			]),
		),
	)
}

/** A card's link: the whole card, with the keyboard ring. */
export function CardLink({
	mood,
	className = "",
	style,
	children,
}: {
	mood: MoodCard
	className?: string
	style?: React.CSSProperties
	children: React.ReactNode
}) {
	return (
		<Link
			to={mood.to}
			prefetch="intent"
			aria-label={`${mood.place.label}${mood.copy ? `: ${mood.copy.short}` : ""}`}
			className={`${FOCUS} block ${className}`}
			style={style}
		>
			{children}
		</Link>
	)
}

/** Closeness eased so the near few separate from the rest: 0-1. */
export const ease = (c: number | null) => (c === null ? 1 : c ** 1.6)

function Cells({
	moods,
	cols,
	fit,
	tuned,
	focus,
	onFocus,
	size,
	Card,
	gap,
	className,
}: {
	moods: MoodCard[]
	cols: number
	fit: Map<string, number> | null
	tuned: Map<string, number> | null
	focus: string | null
	onFocus: (slug: string | null) => void
	size: "s" | "m"
	Card: MoodCardView
	gap: string
	className: string
}) {
	const best = fit ? [...fit].sort((a, b) => b[1] - a[1])[0]?.[0] : null
	return (
		<ul
			className={`${className} grid ${gap}`}
			style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
			onPointerLeave={() => onFocus(null)}
		>
			{lattice(moods, cols).map(({ mood, row, col }) => (
				// oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- hover and focus of the card's own link, caught here to light its neighbors
				<li
					key={mood.place.slug}
					data-mood={mood.place.slug}
					style={{ gridRow: row + 1, gridColumn: col + 1 }}
					className="flex min-w-0 *:w-full"
					onPointerEnter={(e) => {
						if (e.pointerType === "mouse") onFocus(mood.place.slug)
					}}
					onFocus={() => onFocus(mood.place.slug)}
					onBlur={() => onFocus(null)}
				>
					<Card
						mood={mood}
						c={fit?.get(mood.place.slug) ?? null}
						focus={mood.place.slug === (focus ?? best)}
						tuned={tuned?.get(mood.place.slug) ?? null}
						pointed={mood.place.slug === focus}
						row={row}
						col={col}
						size={size}
					/>
				</li>
			))}
		</ul>
	)
}

function Axis({
	low,
	high,
	at,
	vertical = false,
}: {
	low: string
	high: string
	at: number | null
	vertical?: boolean
}) {
	return (
		<div
			className={`flex items-center gap-2.5 ${CAPTION} !tracking-[0.1em] ${vertical ? "absolute inset-0 [writing-mode:vertical-rl]" : ""}`}
		>
			<span
				className={`transition-colors duration-[160ms] ${at !== null && at < 0.4 ? "!text-white" : ""}`}
			>
				{low}
			</span>
			<span aria-hidden className="relative flex-1 self-stretch">
				<span
					className={`absolute bg-white/15 ${vertical ? "inset-y-0 left-1/2 w-px" : "inset-x-0 top-1/2 h-px"}`}
				/>
				<span
					className="absolute h-2 w-2 rounded-full bg-amber-400 transition-[left,top,opacity,transform] duration-[380ms] ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none"
					style={{
						[vertical ? "top" : "left"]: `${4 + (at ?? 0.5) * 92}%`,
						[vertical ? "left" : "top"]: "50%",
						transform: `translate(-50%, -50%) scale(${at === null ? 0 : 1})`,
						opacity: at === null ? 0 : 1,
					}}
				/>
			</span>
			<span
				className={`transition-colors duration-[160ms] ${at !== null && at > 0.6 ? "!text-white" : ""}`}
			>
				{high}
			</span>
		</div>
	)
}

/** The whole moods page with one card design. `gap` is the grid gap (a card design may want air or none). */
export function LatticePage({
	data,
	Card,
	gap = "gap-3 sm:gap-4",
}: {
	data: MoodsData
	Card: MoodCardView
	gap?: string
}) {
	const tuner = useTuner(data.dials)
	const settings = tuner.settings
	const [focus, setFocus] = useState<string | null>(null)
	const tuned = fits(data.moods, data.dials, settings)
	const fit = focus ? near(data.moods, data.dials, focus) : tuned
	const pointed = focus ? data.moods.find((m) => m.place.slug === focus) : undefined
	const tone = pointed ? pointed.tone : (settings.tone ?? null)
	const pace = pointed ? pointed.pace : (settings.pace ?? null)
	const ranked = fit
		? [...data.moods].sort((a, b) => (fit.get(b.place.slug) ?? 0) - (fit.get(a.place.slug) ?? 0))
		: []
	const names = (list: MoodCard[]) => list.map((m) => m.place.label).join(", ")
	return (
		<>
			<Head d={data.head} />
			<div className={`${WRAP} space-y-8`}>
				<div className="space-y-2.5">
					<TunerRow dials={data.dials} tuner={tuner} />
					<p className="min-h-[1.25rem] text-sm text-gray-400" aria-live="polite">
						{pointed ? (
							<>
								<span className="font-semibold text-white">Close to {pointed.place.label}:</span>{" "}
								{names(ranked.slice(1, 4))}
							</>
						) : tuned && ranked[0] ? (
							<>
								<span className="font-semibold text-white">{tunedLine(data.dials, settings)}:</span>{" "}
								{names(ranked.slice(0, 3))}
							</>
						) : (
							"Lighter to the left, darker to the right, calmer at the top, more intense at the bottom."
						)}
					</p>
				</div>
				<div
					className="grid grid-cols-[1rem_minmax(0,1fr)] gap-x-2.5 gap-y-3 sm:gap-x-3.5"
					data-moods-lattice=""
				>
					<span />
					<Axis low="Lighter" high="Darker" at={tone} />
					<div className="relative">
						<Axis low="Calmer" high="More intense" at={pace} vertical />
					</div>
					<div className="min-w-0">
						<Cells
							moods={data.moods}
							cols={4}
							fit={fit}
							tuned={tuned}
							focus={focus}
							onFocus={setFocus}
							size="m"
							Card={Card}
							gap={gap}
							className="hidden lg:grid"
						/>
						<Cells
							moods={data.moods}
							cols={2}
							fit={fit}
							tuned={tuned}
							focus={focus}
							onFocus={setFocus}
							size="s"
							Card={Card}
							gap={gap}
							className="grid lg:hidden"
						/>
					</div>
				</div>
			</div>
		</>
	)
}
