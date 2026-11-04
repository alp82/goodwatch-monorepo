// The fingerprint's effect lines ("Leaves you in awe.", one per line, type size by strength, in the color of the
// effect's lead family) and a dial to read (an arc, the scale's name and word, nothing to press).
import type {
	Phrase,
	ScaleReading,
} from "~/ui/details/fingerprint-section/reading"

const DISPLAY = '"Gabarito", ui-sans-serif, system-ui, sans-serif'

/** The largest type size that still fits every line on one line. */
function fitHi(rows: Phrase[], extra = 0) {
	const terms = rows
		.filter((p) => p.k > 0.05)
		.map(
			(p) =>
				`calc(var(--lo) + (98cqi / ${(`${p.r.effect.name}.`.length * 0.48 + 0.4 + extra).toFixed(2)} - var(--lo)) / ${p.k.toFixed(3)})`,
		)
	return `min(var(--hi-max)${terms.map((x) => `, ${x}`).join("")})`
}

export const lineColor = (p: Phrase) =>
	p.r.counts ? p.color : `color-mix(in srgb, ${p.color} 50%, #78716c)`

export const lineStyle = (p: Phrase) => ({
	color: lineColor(p),
	fontSize: `calc(var(--lo) + (var(--hi) - var(--lo)) * ${p.k.toFixed(3)})`,
	fontWeight: Math.round(560 + 300 * p.k),
	letterSpacing: `${(-0.004 - 0.022 * p.k).toFixed(3)}em`,
})

/** Sizes: "md" for the title page's column, "lg" for the sub-page, "sm" beside a drawing. */
const SIZES = {
	sm: "[--lo:17px] [--hi-max:26px] @min-[420px]:[--lo:18px] @min-[420px]:[--hi-max:30px]",
	md: "[--lo:19px] [--hi-max:30px] @min-[420px]:[--lo:21px] @min-[420px]:[--hi-max:38px] @min-[520px]:[--lo:22px] @min-[520px]:[--hi-max:42px]",
	lg: "[--lo:20px] [--hi-max:32px] @min-[420px]:[--lo:22px] @min-[420px]:[--hi-max:40px] @min-[520px]:[--lo:23px] @min-[520px]:[--hi-max:44px]",
}

export function Lines({
	rows,
	size = "md",
	center = false,
	values = false,
	active = null,
	onHover,
}: {
	rows: Phrase[]
	size?: keyof typeof SIZES
	center?: boolean
	/** Each line's strength out of 10, quietly after it. */
	values?: boolean
	/** The line being pointed at (the others dim a little). */
	active?: string | null
	/** Mouse and keyboard focus: the line pointed at. */
	onHover?: (id: string | null) => void
}) {
	return (
		<div
			className={`@container ${SIZES[size]}`}
			style={{
				fontFamily: DISPLAY,
				["--hi" as string]: fitHi(rows, values ? 2 : 0),
			}}
		>
			{/* Only leaving the whole list lets go, so moving from line to line never passes through none. */}
			<ul
				onPointerLeave={
					onHover
						? (e) => e.pointerType === "mouse" && onHover(null)
						: undefined
				}
			>
				{rows.map((p) => {
					const id = p.r.effect.id
					const body = (
						<>
							{p.r.effect.name}.
							{values && (
								<span className="ml-[.4em] align-[.12em] font-sans text-[13px] font-semibold tracking-normal text-gray-500 tabular-nums">
									{p.r.strength.toFixed(1)}
								</span>
							)}
						</>
					)
					const cls = `block leading-[1.12] whitespace-nowrap py-[.12em] ${center ? "text-center" : "text-left"}`
					return (
						<li
							key={id}
							className="fp-fade"
							style={{ opacity: active && active !== id ? 0.45 : 1 }}
						>
							{onHover ? (
								<button
									type="button"
									onPointerEnter={(e) =>
										e.pointerType === "mouse" && onHover(id)
									}
									// Keyboard focus points; a tap's focus leaves it to the click, which would else take it back at once.
									onFocus={(e) =>
										e.currentTarget.matches(":focus-visible") && onHover(id)
									}
									onBlur={() => onHover(null)}
									onClick={() => onHover(active === id ? null : id)}
									aria-pressed={active === id}
									className={`${cls} -mx-2 w-[calc(100%+1rem)] cursor-default rounded-lg px-2 outline-none focus-visible:outline-2 focus-visible:outline-amber-300`}
									style={lineStyle(p)}
								>
									{body}
								</button>
							) : (
								<span className={cls} style={lineStyle(p)}>
									{body}
								</span>
							)}
						</li>
					)
				})}
			</ul>
		</div>
	)
}

export function NotFor({
	line,
	className = "",
}: { line: string; className?: string }) {
	if (!line) return null
	return (
		<p className={`text-[15px] font-medium text-gray-500 ${className}`}>
			{line}
		</p>
	)
}

const BG = "#0c0a09"

export function ArcGlyph({
	s,
	className = "h-3.5 w-9",
}: { s: ScaleReading; className?: string }) {
	const R = 20
	const half = 0.72
	const pt = (p: number) => {
		const a = -Math.PI / 2 - half + 2 * half * p
		return [18 + R * Math.cos(a), 24 + R * Math.sin(a)] as const
	}
	const arc = (p0: number, p1: number) => {
		const [x0, y0] = pt(p0)
		const [x1, y1] = pt(p1)
		return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${R} ${R} 0 0 ${p1 >= p0 ? 1 : 0} ${x1.toFixed(1)} ${y1.toFixed(1)}`
	}
	const from = s.sc.fromMiddle ? 0.5 : 0
	const [dx, dy] = pt(s.position)
	return (
		<svg
			viewBox="0 0 36 14"
			className={`shrink-0 overflow-visible ${className}`}
			aria-hidden="true"
		>
			<path
				d={arc(0, 1)}
				fill="none"
				stroke={s.color}
				strokeOpacity={0.22}
				strokeWidth={3.2}
				strokeLinecap="round"
			/>
			{s.sc.fromMiddle && (
				<line
					x1={18}
					y1={1.5}
					x2={18}
					y2={6.5}
					stroke="white"
					strokeOpacity={0.3}
					strokeWidth={1}
				/>
			)}
			{Math.abs(s.position - from) > 0.01 && (
				<path
					d={arc(from, s.position)}
					fill="none"
					stroke={s.color}
					strokeOpacity={0.85}
					strokeWidth={3.2}
					strokeLinecap="round"
				/>
			)}
			<circle
				cx={dx.toFixed(1)}
				cy={dy.toFixed(1)}
				r={3.4}
				fill={s.color}
				stroke={BG}
				strokeWidth={1.5}
			/>
		</svg>
	)
}

/** A dial to read, not press: arc, scale name, word; `ends` adds the scale's two ends under it. */
export function StaticDial({
	s,
	ends = false,
}: { s: ScaleReading; ends?: boolean }) {
	return (
		<div className="flex min-w-0 items-center gap-2.5 py-1">
			<ArcGlyph s={s} />
			<span className="min-w-0 leading-tight">
				<span className="block truncate text-[11px] text-gray-500">
					{s.sc.name}
				</span>
				<span className="block truncate text-[13px] font-semibold text-gray-100">
					{s.word}
				</span>
				{ends && (
					<span className="block truncate text-[11px] text-gray-600">
						{s.sc.left} to {s.sc.right.toLowerCase()}
					</span>
				)}
			</span>
		</div>
	)
}
