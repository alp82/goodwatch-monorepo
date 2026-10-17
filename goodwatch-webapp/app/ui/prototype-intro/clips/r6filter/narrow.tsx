// PROTOTYPE - throwaway. Round 6, chapter 6 (filters): "From everything to tonight." with the big number, big
// posters and clear filters. Real Discover counts from round 5's snapshot (data.extra.r5filter): a guest's two
// services, then Not seen yet (an example member who has seen the best-known titles, labelled), a mood, an age limit
// and the score.
//
// The posters show what each filter does: the ones it removes drop out, the ones that stay slide into their new
// places, new ones deal in. Each step's row is its own layer; a poster that stays is handed from one layer to the next
// at the same spot, so nothing jumps. All times are ms at k = 1 and go through `--k` in CSS.
import type { CSSProperties, ReactNode } from "react"
import type { R5FilterData, R5Path, R5Step, R5Title } from "~/server/prototype-intro/r5filter.server"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { IntroData } from "../../clip"

export const filterData = (data: IntroData) => (data.extra.r5filter ?? null) as R5FilterData | null

const ms = (n: number) => `${Math.round(n)}ms`
export const fmt = (n: number) => n.toLocaleString("en-US")

/** When each filter switches on, and when its result (number, posters) arrives. */
export type Timeline = { on: number[]; swap: number[]; drop: number[]; stamp: number[] }

/** Filters every ~2 s; Not seen yet takes longer, its Seen stamps go first. */
export function timeline(steps: R5Step[], first = 700, each = 1950): Timeline {
	const on: number[] = []
	const swap: number[] = []
	const drop: number[] = []
	const stamp: number[] = []
	let t = first
	steps.forEach((s, i) => {
		on.push(t)
		const seen = s.kind === "seen"
		stamp.push(t + 300)
		drop.push(t + (seen ? 1000 : 350))
		swap.push(i === 0 ? t : t + (seen ? 1500 : 800))
		t += each + (seen ? 450 : 0)
	})
	return { on, swap, drop, stamp }
}

/** The clip's length: the last result, a beat for its posters, then a hold to read it. */
export const lengthOf = (tl: Timeline) => tl.swap[tl.swap.length - 1] + 2600

/** The chip's words, as a visitor reads them. */
export const label = (s: R5Step) => {
	if (s.kind === "services") return "On my services"
	if (s.kind === "age") return s.chip.replace(/ \/ .*/, "")
	return s.chip
}

/** What the number means after a step. */
export const caption = (s: R5Step, d: R5FilterData, last: boolean, before?: R5Step) => {
	if (last) return "worth watching tonight"
	switch (s.kind) {
		case "services":
			return `titles on ${d.services.map((x) => (x.id === 9 ? "Prime Video" : x.name)).join(" and ")}`
		case "seen":
			return `you haven't seen yet${before ? ` (−${fmt(before.total - s.total)})` : ""}`
		case "mood":
			return `${s.chip.toLowerCase()} ones`
		case "age":
			return `rated ${s.chip.replace(/^Up to /, "up to ")}`
		case "score":
			return "scored 70 or more"
		default:
			return "left"
	}
}

// ---------------------------------------------------------------------------------------------------------------
// Timed layers. `Show` appears at `at` (and is hidden before), `Hide` disappears at `at`, `Fall` drops away at `at`.

export function Show({ at, children, className = "", style }: { at: number; children: ReactNode; className?: string; style?: CSSProperties }) {
	return (
		<div className={`lp6f-show ${className}`} style={{ ...style, "--a": ms(at) } as CSSProperties}>
			{children}
		</div>
	)
}
export function Exit({ at, kind, children }: { at?: number; kind: "hide" | "fall" | "lift"; children: ReactNode }) {
	if (at === undefined) return <>{children}</>
	return (
		<div className={`lp6f-exit lp6f-exit-${kind}`} style={{ "--x": ms(at) } as CSSProperties}>
			{children}
		</div>
	)
}
export function Motion({ kind, at, children, style }: { kind: "deal" | "rise" | "pop" | "slide"; at: number; children: ReactNode; style?: CSSProperties }) {
	return (
		<div className={`lp6f-m lp6f-m-${kind}`} style={{ ...style, "--d": ms(at) } as CSSProperties}>
			{children}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The big number: each step's count rises in as the one before lifts away.

export function BigNumber({ steps, tl, d, className = "" }: { steps: R5Step[]; tl: Timeline; d: R5FilterData; className?: string }) {
	const last = steps.length - 1
	return (
		<div className={`lp6f-number ${className}`}>
			<div className="lp6f-number-n">
				{steps.map((s, i) => (
					<Show key={s.id} at={i === 0 ? 0 : tl.swap[i] + 220} className="lp6f-layer">
						<Exit at={i < last ? tl.swap[i + 1] : undefined} kind="lift">
							<Motion kind="rise" at={i === 0 ? tl.swap[0] : tl.swap[i] + 220}>
								<span className={i === last ? "lp6f-amber" : undefined}>{fmt(s.total)}</span>
							</Motion>
						</Exit>
					</Show>
				))}
				{/* Holds the line's height: the widest number, invisible. */}
				<span className="lp6f-number-hold" aria-hidden="true">
					{fmt(steps[0].total)}
				</span>
			</div>
			<div className="lp6f-number-caption">
				{steps.map((s, i) => (
					<Show key={s.id} at={i === 0 ? 0 : tl.swap[i] + 320} className="lp6f-layer">
						<Exit at={i < last ? tl.swap[i + 1] : undefined} kind="lift">
							<Motion kind="rise" at={i === 0 ? tl.swap[0] + 120 : tl.swap[i] + 320}>
								<span className={i === last ? "lp6f-amber" : undefined}>{caption(s, d, i === last, steps[i - 1])}</span>
							</Motion>
						</Exit>
					</Show>
				))}
				<span className="lp6f-number-hold" aria-hidden="true">
					worth watching tonight
				</span>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// A filter as a big toggle: off (outlined), then it switches on with a punch, its mark and a check.

export function Mark({ step, d }: { step: R5Step; d: R5FilterData }) {
	if (step.kind === "services")
		return (
			<span className="lp6f-logos">
				{d.services.map((s) => (s.logo ? <img key={s.id} src={tmdbImageUrl(s.logo, "w92")} alt="" /> : null))}
			</span>
		)
	if (step.kind === "mood") {
		const hue = d.moods.find((m) => m.name.toLowerCase().startsWith(step.chip.toLowerCase().slice(0, 4)))?.hue ?? "#fbbf24"
		return <span className="lp6f-dot" style={{ background: hue }} />
	}
	const icon: Record<string, string> = {
		seen: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 3l18 18",
		age: "M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z",
		score: "M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7L12 2Z",
	}
	return (
		<svg viewBox="0 0 24 24" className="lp6f-icon" aria-hidden="true">
			<path d={icon[step.kind] ?? icon.age} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	)
}

export function Toggle({ step, d, appear, on, className = "", tag = true }: { step: R5Step; d: R5FilterData; appear: number; on: number; className?: string; tag?: boolean }) {
	return (
		<Motion kind="deal" at={appear}>
			<div className={`lp6f-toggle ${className}`} style={{ "--on": ms(on) } as CSSProperties}>
				<span className="lp6f-toggle-mark">
					<Mark step={step} d={d} />
				</span>
				<span className="lp6f-toggle-label">{label(step)}</span>
				{tag && step.kind === "seen" && <span className="lp6f-toggle-tag">example member</span>}
				<span className="lp6f-switch" aria-hidden="true">
					<span className="lp6f-switch-knob" />
				</span>
			</div>
		</Motion>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The posters: one layer per step; what a filter removes drops out (Seen stamps first), what stays slides over.

export function Posters({
	path,
	tl,
	cols,
	rows = 1,
	first = 250,
	className = "",
}: {
	path: R5Path
	tl: Timeline
	cols: number
	rows?: number
	/** After the first result, when the first posters deal in. */
	first?: number
	className?: string
}) {
	const n = cols * rows
	const lists = path.steps.map((s) => uniq(s.titles).slice(0, n))
	const last = lists.length - 1
	const pos = (k: number) => ({ c: k % cols, r: Math.floor(k / cols) })
	return (
		<div className={`lp6f-posters ${className}`} style={{ "--cols": cols, "--rows": rows } as CSSProperties}>
			{lists.map((list, i) =>
				list.map((t, k) => {
					const prev = i > 0 ? lists[i - 1].findIndex((x) => x.key === t.key) : -1
					const stays = i < last && lists[i + 1].some((x) => x.key === t.key)
					const nextSeen = path.steps[i + 1]?.kind === "seen"
					const { c, r } = pos(k)
					const at = i === 0 ? 0 : tl.swap[i]
					const motion =
						i === 0 ? (
							<Motion kind="deal" at={tl.swap[0] + first + k * 80}>
								<Poster title={t} />
							</Motion>
						) : prev >= 0 ? (
							<Motion
								kind="slide"
								at={tl.swap[i]}
								style={{ "--dx": pos(prev).c - c, "--dy": pos(prev).r - r } as CSSProperties}
							>
								<Poster title={t} />
							</Motion>
						) : (
							<Motion kind="deal" at={tl.swap[i] + 180 + k * 70}>
								<Poster title={t} />
							</Motion>
						)
					return (
						<div key={`${i}-${t.key}`} className={`lp6f-cell lp6f-col${c}`} style={{ "--c": c, "--r": r } as CSSProperties}>
							<Show at={at}>
								<Exit at={i < last ? (stays ? tl.swap[i + 1] + 40 : tl.drop[i + 1] + k * 40) : undefined} kind={stays ? "hide" : "fall"}>
									{motion}
									{!stays && nextSeen && (
										<span className="lp6f-stamp" style={{ "--d": ms(tl.stamp[i + 1] + k * 50) } as CSSProperties}>
											Seen
										</span>
									)}
								</Exit>
							</Show>
						</div>
					)
				}),
			)}
		</div>
	)
}

function Poster({ title }: { title: R5Title }) {
	return title.poster ? (
		<img src={tmdbImageUrl(title.poster, "w342")} alt="" className="lp6f-poster" draggable={false} />
	) : (
		<span className="lp6f-poster lp6f-poster-none">{title.title}</span>
	)
}

const uniq = (titles: R5Title[]) => titles.filter((t, i) => titles.findIndex((x) => x.key === t.key) === i)

/** A headline whose words rise one after another; `amber` words are amber. */
export function Words({ text, at, amber = [], className = "" }: { text: string; at: number; amber?: string[]; className?: string }) {
	return (
		<h2 className={`lp6f-h ${className}`}>
			{text.split(" ").map((w, i) => (
				<span key={i}>
					{i > 0 && " "}
					<span
						className={`lp6f-m lp6f-m-rise lp6f-word ${amber.includes(w.replace(/[.,!]/g, "")) ? "lp6f-amber" : ""}`}
						style={{ "--d": ms(at + i * 140) } as CSSProperties}
					>
						{w}
					</span>
				</span>
			))}
		</h2>
	)
}
