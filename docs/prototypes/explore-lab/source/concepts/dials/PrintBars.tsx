// PROTOTYPE - throwaway (prototype/explore-r4, concept "dials"). A genre's shape: its fingerprint as bars. One bar per
// attribute, grouped by fingerprint family and sorted tallest first inside each group, so the silhouette reads at a
// glance. Behind every bar a quiet ghost shows how much of it titles usually have. The few attributes that make the
// genre what it is are bright and carry their word above the chart, joined to their bar by a line. Pointing at a bar
// or a word lights both; a tap pins it; the pinned word leads to that trait's own place.
import { Link } from "@remix-run/react"
import { type KeyboardEvent, type PointerEvent, useMemo, useRef, useState } from "react"
import { CAPTION } from "~/ui/eyebrow"
import type { PrintBar, PrintFamily, TraitWord } from "../../kit/types"
import { PANEL } from "../../kit/ui"

type Bar = PrintBar & { to?: string }

const ORDER: PrintFamily[] = ["feel", "humor", "world", "story", "craft"]
const GROUP_LABEL: Record<PrintFamily, string> = {
	feel: "How it feels",
	humor: "Humor",
	world: "Its world",
	story: "Its story",
	craft: "How it's made",
}
const GAP = 1.6
/** Height of the connector strip between the words and the bars, in px. */
const LINK_H = 48

function phrase(value: number, base: number, noun: string) {
	const d = value - base
	if (d >= 3) return `far more than most ${noun}`
	if (d >= 1.2) return `more than most ${noun}`
	if (d <= -3) return `far less than most ${noun}`
	if (d <= -1.2) return `less than most ${noun}`
	return `about as much as most ${noun}`
}

export function PrintBars({
	bars,
	standouts,
	noun,
	what,
}: {
	bars: Bar[]
	/** The attributes that set the place apart, strongest first. */
	standouts: TraitWord[]
	/** "movies" */
	noun: string
	/** "horror movies" */
	what: string
}) {
	const layout = useMemo(() => {
		const groups = ORDER.map((family) => ({
			family,
			bars: bars.filter((b) => b.family === family).sort((a, b) => b.value - a.value),
		})).filter((g) => g.bars.length)
		const total = bars.length + (groups.length - 1) * GAP
		let u = 0
		const placed: { bar: Bar; x: number }[] = []
		const spans = groups.map((g) => {
			const start = u
			for (const bar of g.bars) placed.push({ bar, x: u++ })
			const span = { family: g.family, color: g.bars[0].color, start, len: g.bars.length }
			u += GAP
			return span
		})
		return { placed, spans, total }
	}, [bars])
	const { placed, spans, total } = layout
	const center = (x: number) => ((x + 0.5) / total) * 100
	const marked = standouts
		.map((t) => ({ trait: t, at: placed.find((p) => p.bar.key === t.key) }))
		.filter((m): m is { trait: TraitWord; at: { bar: Bar; x: number } } => !!m.at)
		.sort((a, b) => a.at.x - b.at.x)
	const markedKeys = new Set(marked.map((m) => m.trait.key))
	// Each word sits over its bar; words whose bars are neighbors spread just far enough apart to stay readable.
	const SPACE = 10.5
	const spots = marked.map((m) => center(m.at.x))
	for (let i = 0; i < spots.length; i++)
		spots[i] = Math.max(spots[i], i ? spots[i - 1] + SPACE : SPACE / 2 - 1)
	for (let i = spots.length - 1; i >= 0; i--)
		spots[i] = Math.min(
			spots[i],
			i === spots.length - 1 ? 100 - SPACE / 2 + 1 : spots[i + 1] - SPACE,
		)

	// Where each connector turns. Inside a run of words that all sit to the same side of their bars, the bar furthest
	// that way turns lowest: lines then nest like brackets and can't cross.
	const turns = spots.map(() => LINK_H - 8)
	for (let i = 0; i < marked.length;) {
		const side = Math.sign(Math.round((spots[i] - center(marked[i].at.x)) * 10))
		let j = i
		while (
			j + 1 < marked.length &&
			Math.sign(Math.round((spots[j + 1] - center(marked[j + 1].at.x)) * 10)) === side
		)
			j++
		for (let k = i; k <= j; k++) {
			const depth = side > 0 ? j - k : k - i
			turns[k] = LINK_H - 8 - depth * 7
		}
		i = j + 1
	}

	const [hot, setHot] = useState<string | null>(null)
	const [pinned, setPinned] = useState<string | null>(null)
	const active = hot ?? pinned
	const chart = useRef<HTMLDivElement>(null)
	const keyAt = (e: PointerEvent) => {
		const r = chart.current?.getBoundingClientRect()
		if (!r) return null
		const u = ((e.clientX - r.left) / r.width) * total
		let best: { bar: Bar; x: number } | null = null
		for (const p of placed)
			if (!best || Math.abs(p.x + 0.5 - u) < Math.abs(best.x + 0.5 - u)) best = p
		return best?.bar.key ?? null
	}
	const onKey = (e: KeyboardEvent) => {
		if (!["ArrowLeft", "ArrowRight", "Escape"].includes(e.key)) return
		e.preventDefault()
		if (e.key === "Escape") return setPinned(null)
		const i = placed.findIndex((p) => p.bar.key === (pinned ?? marked[0]?.trait.key))
		const next =
			placed[Math.min(placed.length - 1, Math.max(0, i + (e.key === "ArrowRight" ? 1 : -1)))]
		setPinned(next.bar.key)
	}
	const shown = placed.find((p) => p.bar.key === active)?.bar ?? null
	const shownTrait = standouts.find((t) => t.key === shown?.key)

	return (
		<section
			aria-label={`What ${what} are made of`}
			className={`${PANEL} px-4 pt-4 pb-4 sm:px-6 sm:pt-5`}
		>
			<p className={CAPTION}>What {what} are made of</p>

			{/* The words of the standouts, each joined to its bar */}
			<div className="relative mt-3 hidden h-8 md:block">
				{marked.map(({ trait: t }, i) => {
					const on = active === t.key
					const cls = `absolute top-0 block -translate-x-1/2 rounded-full px-2.5 py-1 text-sm font-bold whitespace-nowrap outline-none transition-[background-color,opacity] duration-200 focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? "bg-white/10" : "hover:bg-white/10"} ${active && !on ? "opacity-40" : ""}`
					const hover = {
						onMouseEnter: () => setHot(t.key),
						onMouseLeave: () => setHot(null),
						onFocus: () => setHot(t.key),
						onBlur: () => setHot(null),
					}
					const to = placed.find((p) => p.bar.key === t.key)?.bar.to
					const style = { color: t.color, left: `${spots[i]}%` }
					return to ? (
						<Link key={t.key} to={to} prefetch="intent" {...hover} className={cls} style={style}>
							{t.word.charAt(0).toUpperCase() + t.word.slice(1)}
						</Link>
					) : (
						<span key={t.key} {...hover} className={cls} style={style}>
							{t.word.charAt(0).toUpperCase() + t.word.slice(1)}
						</span>
					)
				})}
			</div>
			{/* Elbow connectors: each word drops straight down, turns once at its own height, and lands on its bar.
			    Neighboring bars turn at different heights (the far one lowest), so no two lines ever cross. */}
			<svg
				aria-hidden
				viewBox={`0 0 100 ${LINK_H}`}
				preserveAspectRatio="none"
				className="hidden w-full md:block"
				style={{ height: LINK_H }}
			>
				{marked.map(({ trait: t, at }, i) => {
					const x1 = spots[i]
					const x2 = center(at.x)
					const y = turns[i]
					return (
						<path
							key={t.key}
							d={
								Math.abs(x1 - x2) < 0.05
									? `M${x2} 0 V${LINK_H}`
									: `M${x1} 0 V${y} H${x2} V${LINK_H}`
							}
							fill="none"
							stroke={t.color}
							strokeWidth={active === t.key ? 2 : 1.25}
							strokeLinejoin="round"
							vectorEffect="non-scaling-stroke"
							className="transition-opacity duration-200"
							opacity={active ? (active === t.key ? 1 : 0.12) : 0.7}
						/>
					)
				})}
			</svg>

			{/* On a phone: the standouts as rows, each word beside its own bar (74 bars would be hairlines there). */}
			<ul className="mt-3 space-y-2.5 md:hidden">
				{marked.map(({ trait: t, at }) => (
					<li key={t.key} className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3">
						{at.bar.to ? (
							<Link
								to={at.bar.to}
								prefetch="intent"
								className="truncate rounded-sm text-[15px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
								style={{ color: t.color }}
							>
								{t.word.charAt(0).toUpperCase() + t.word.slice(1)} ›
							</Link>
						) : (
							<span className="truncate text-[15px] font-bold" style={{ color: t.color }}>
								{t.word.charAt(0).toUpperCase() + t.word.slice(1)}
							</span>
						)}
						<span className="relative block h-2.5 rounded-full bg-white/[0.07]">
							<span
								className="absolute inset-y-0 left-0 rounded-full bg-white/[0.16]"
								style={{ width: `${at.bar.base * 10}%` }}
							/>
							<span
								className="absolute inset-y-0 left-0 rounded-full"
								style={{ width: `${at.bar.value * 10}%`, background: t.color }}
							/>
						</span>
					</li>
				))}
			</ul>
			<p className="mt-3 text-sm leading-snug text-gray-400 md:hidden">
				The colored bar is {what}; the pale one behind it is what {noun} usually have. Tap a word to
				turn it up or down.
			</p>

			{/* The bars */}
			<div
				ref={chart}
				role="group"
				data-keys=""
				tabIndex={0}
				aria-label="Fingerprint bars. Use the arrow keys to move from bar to bar."
				onPointerMove={(e) => e.pointerType === "mouse" && setHot(keyAt(e))}
				onPointerLeave={() => setHot(null)}
				onPointerDown={(e) => {
					const k = keyAt(e)
					setPinned((cur) => (cur === k ? null : k))
				}}
				onKeyDown={onKey}
				className="relative h-32 cursor-pointer touch-pan-y rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-amber-400 max-md:hidden"
			>
				{placed.map(({ bar, x }) => {
					const on = active === bar.key
					const bright = markedKeys.has(bar.key)
					return (
						<div
							key={bar.key}
							className="absolute inset-y-0"
							style={{ left: `${(x / total) * 100}%`, width: `${100 / total}%` }}
						>
							{bright && (
								<span
									className="absolute top-0 left-1/2 w-px -translate-x-1/2 transition-opacity duration-200"
									style={{
										height: `${100 - bar.value * 10}%`,
										background: bar.color,
										opacity: active ? (on ? 0.9 : 0.1) : 0.45,
									}}
								/>
							)}
							<span
								className="absolute inset-x-[12%] bottom-0 rounded-t-[2px] bg-white/[0.1]"
								style={{ height: `${bar.base * 10}%` }}
							/>
							<span
								className="absolute inset-x-[12%] bottom-0 origin-bottom rounded-t-[2px] transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none"
								style={{
									height: `${Math.max(1.5, bar.value * 10)}%`,
									background: bar.color,
									opacity: on ? 1 : active ? 0.22 : bright ? 1 : 0.42,
									transform: on ? "scaleY(1.04)" : undefined,
								}}
							/>
						</div>
					)
				})}
			</div>
			<div className="relative mt-1.5 h-4 max-md:hidden">
				{spans.map((s) => (
					<span
						key={s.family}
						className={`absolute flex items-center gap-1.5 overflow-hidden ${CAPTION} !tracking-[0.08em] whitespace-nowrap`}
						style={{
							left: `${(s.start / total) * 100}%`,
							width: `${((s.len + GAP * 0.6) / total) * 100}%`,
						}}
					>
						<span
							aria-hidden
							className="h-1.5 w-1.5 shrink-0 rounded-full"
							style={{ background: s.color }}
						/>
						<span className="truncate">{GROUP_LABEL[s.family]}</span>
					</span>
				))}
			</div>

			{/* What the bar under the pointer (or the pinned one) says */}
			<p
				aria-live="polite"
				className="mt-3 min-h-[1.5rem] text-sm leading-snug text-gray-400 max-md:hidden"
			>
				{shown ? (
					<>
						<span className="font-bold" style={{ color: shown.color }}>
							{shown.label}
						</span>
						<span className="text-gray-300">: {phrase(shown.value, shown.base, noun)}.</span>
						{shownTrait && <span> {shownTrait.meaning}</span>}
						{shown.to && pinned === shown.key && (
							<Link
								to={shown.to}
								prefetch="intent"
								className="ml-2 rounded-sm font-bold whitespace-nowrap text-amber-300 outline-none hover:text-amber-200 focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								Turn this one up or down ›
							</Link>
						)}
					</>
				) : (
					<>
						The bright bars are what set {what} apart; the pale shape behind is what {noun} usually
						have. <span className="max-md:hidden">Point at a bar, or click to pin it.</span>
						<span className="md:hidden">Tap a bar.</span>
					</>
				)}
			</p>
		</section>
	)
}
