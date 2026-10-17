// PROTOTYPE - throwaway. Helpers for the round 5 filter clips: the data, timed wrappers (in at one moment, out at
// another, each its own element so the two animations never fight), the count, chips and the poster grid.
// All times are ms at k = 1 and go through `--k` in CSS.
import type { CSSProperties, ReactNode } from "react"
import type { R5FilterData, R5Step, R5Title } from "~/server/prototype-intro/r5filter.server"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { IntroData } from "../../clip"

export const r5Data = (data: IntroData) => (data.extra.r5filter ?? null) as R5FilterData | null

const d = (ms: number) => `${ms}ms`

/**
 * Shows its children from `from` (entering with `enter`) until `to` (leaving with `leave`). `final` marks what the
 * last frame keeps, for reduced motion.
 */
export function Window({
	from,
	to,
	enter = "rise",
	leave = "lift",
	className = "",
	style,
	children,
}: {
	from: number
	to?: number
	enter?: "rise" | "deal" | "pop" | "fade" | "none"
	leave?: "lift" | "fall" | "fade" | "shrink"
	className?: string
	style?: CSSProperties
	children: ReactNode
}) {
	const inner = (
		<div className={`lpc-r5filter-e lpc-r5filter-e-${enter}`} style={{ "--d": d(from) } as CSSProperties}>
			{children}
		</div>
	)
	return (
		<div
			className={`lpc-r5filter-w ${to === undefined ? "" : `lpc-r5filter-x lpc-r5filter-x-${leave} lpc-r5filter-past`} ${className}`}
			style={{ ...style, ...(to !== undefined && ({ "--x": d(to) } as CSSProperties)) }}
		>
			{inner}
		</div>
	)
}

/** A number as people read it: 16,166. */
export const fmt = (n: number) => n.toLocaleString("en-US")

/** The count, odometer style: each step's number rises in as the one before lifts away. */
export function Count({ steps, times, className = "", lastAmber = true }: { steps: { total: number }[]; times: number[]; className?: string; lastAmber?: boolean }) {
	return (
		<div className={`lpc-r5filter-count ${className}`}>
			{steps.map((s, i) => (
				<Window
					key={i}
					// The next number rolls in a beat after this one starts to leave: never two in the window at once.
					from={i === 0 ? times[i] : times[i] + 260}
					to={times[i + 1]}
					enter="rise"
					className={`lpc-r5filter-count-n ${lastAmber && i === steps.length - 1 ? "lpc-r5filter-amber" : ""}`}
				>
					{fmt(s.total)}
				</Window>
			))}
		</div>
	)
}

/** A filter chip, as the filter bar draws it, with the mark of its kind. */
export function Chip({
	step,
	data,
	at,
	fresh,
}: {
	step: Pick<R5Step, "kind" | "chip">
	data: R5FilterData
	at: number
	fresh?: number
}) {
	return (
		<span
			className={`lpc-r5filter-chip lpc-r5filter-e lpc-r5filter-e-pop ${fresh !== undefined ? "lpc-r5filter-fresh" : ""}`}
			style={{ "--d": d(at), "--f": d(fresh ?? at) } as CSSProperties}
		>
			<ChipMark step={step} data={data} />
			<span>{step.chip}</span>
		</span>
	)
}

function ChipMark({ step, data }: { step: Pick<R5Step, "kind" | "chip">; data: R5FilterData }) {
	if (step.kind === "services")
		return (
			<span className="lpc-r5filter-logos">
				{data.services.map((s) =>
					s.logo ? <img key={s.id} src={tmdbImageUrl(s.logo, "w92")} alt="" /> : null,
				)}
			</span>
		)
	if (step.kind === "mood") {
		const hue = data.moods.find((m) => m.name.toLowerCase().startsWith(step.chip.toLowerCase().slice(0, 4)))?.hue ?? "#fbbf24"
		return <span className="lpc-r5filter-dot" style={{ background: hue }} />
	}
	const icon: Record<string, string> = {
		seen: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 3l18 18",
		age: "M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z",
		score: "M12 3a9 9 0 1 0 9 9",
		released: "M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
		type: "M4 6h16v12H4z",
	}
	return (
		<svg viewBox="0 0 24 24" className="lpc-r5filter-icon" aria-hidden="true">
			<path d={icon[step.kind] ?? icon.type} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	)
}

/** A small poster. */
export function Poster({ title, className = "" }: { title: R5Title; className?: string }) {
	return title.poster ? (
		<img src={tmdbImageUrl(title.poster, "w185")} alt="" className={`lpc-r5filter-poster ${className}`} draggable={false} />
	) : (
		<span className={`lpc-r5filter-poster lpc-r5filter-poster-none ${className}`}>{title.title}</span>
	)
}

/**
 * A grid of the step's posters that deals in from `from` and leaves at `to`. `seen` marks titles that get the Seen
 * stamp at `stampAt` and fall away, before the grid leaves.
 */
export function Grid({
	titles,
	from,
	to,
	cols,
	rows,
	seen,
	stampAt,
	stagger = 45,
	className = "",
}: {
	titles: R5Title[]
	from: number
	to?: number
	cols: number
	rows: number
	seen?: Set<string>
	stampAt?: number
	stagger?: number
	className?: string
}) {
	const shown = titles.slice(0, cols * rows)
	return (
		<Window from={0} to={to} enter="none" leave="fade" className={`lpc-r5filter-grid-w ${className}`}>
			<div className="lpc-r5filter-grid" style={{ "--cols": cols } as CSSProperties}>
				{shown.map((t, i) => {
					const isSeen = seen?.has(t.key) && stampAt !== undefined
					const tile = (
						<div className="lpc-r5filter-e lpc-r5filter-e-deal" style={{ "--d": d(from + i * stagger) } as CSSProperties}>
							<Poster title={t} />
							{isSeen && (
								<span className="lpc-r5filter-stamp lpc-r5filter-e lpc-r5filter-e-stamp" style={{ "--d": d(stampAt + i * 30) } as CSSProperties}>
									Seen
								</span>
							)}
						</div>
					)
					return (
						<div key={t.key} className="lpc-r5filter-tile">
							{isSeen ? (
								<div className="lpc-r5filter-x lpc-r5filter-x-fall" style={{ "--x": d(stampAt + 650 + i * 30) } as CSSProperties}>
									{tile}
								</div>
							) : (
								tile
							)}
						</div>
					)
				})}
			</div>
		</Window>
	)
}

/** A headline whose words rise one after another. `amber` words are amber. */
export function Words({ text, at, amber = [], className = "" }: { text: string; at: number; amber?: string[]; className?: string }) {
	return (
		<h2 className={`lpc-r5filter-h ${className}`}>
			{text.split(" ").map((w, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: words of a fixed line
					key={i}
					className={`lpc-r5filter-e lpc-r5filter-e-rise lpc-r5filter-word ${amber.includes(w.replace(/[.,!]/g, "")) ? "lpc-r5filter-amber" : ""}`}
					style={{ "--d": d(at + i * 140) } as CSSProperties}
				>
					{w}{" "}
				</span>
			))}
		</h2>
	)
}
