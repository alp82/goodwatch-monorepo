// PROTOTYPE - throwaway. Round 7, chapter 6 (filters): "From everything to tonight." as a panel of switches, refined
// from round 6's filters-r6-panel as the owner asked:
// - It starts with no filter on: the big number is every movie and show Discover has (61,541 locally).
// - Each switch lights in the colour Discover gives that filter: services emerald, Not seen yet blue, the mood its
//   own hue, the age limit amber, the score the GoodWatch vibe colour of its threshold.
// - Not seen yet is a switch like the others; the example member is a quiet footnote, the Seen stamps show the rest.
// - The score switch counts up 60+ → 70+ → 80+, and each threshold takes a poster away.
// Every step changes the posters: the three slots keep the titles that still pass and take the best-known new ones;
// before the score steps they hold one title under 60, one in the 60s and one in the 70s, so each threshold has a
// real title to remove. All counts and titles are real (server/prototype-intro/r7filter.server.ts).
import type { CSSProperties, ReactNode } from "react"
import type { R7FilterData, R7Step, R7Title } from "~/server/prototype-intro/r7filter.server"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { ClipProps } from "../../clip"

const ms = (n: number) => `${Math.round(n)}ms`
const fmt = (n: number) => n.toLocaleString("en-US")
const SLOTS = 3

/** Discover's lit colours (ui/filter-bar): emerald for services, blue for Not seen yet, amber for the age limit. */
// The vibe colours (tailwind.css --color-vibe-*), by tens: Discover's score swatches.
const VIBES: Record<number, string> = {
	0: "#7f1d1d", 10: "#991b1b", 20: "#b91c1c", 30: "#c2410c", 40: "#d97706", 50: "#ca8a04",
	60: "#a3a323", 70: "#65a32d", 80: "#16934a", 90: "#15803d", 100: "#166534",
}
const vibe = (score: number) => VIBES[Math.min(100, Math.floor(score / 10) * 10)]
const VIBE: Record<number, string> = { 60: VIBES[60], 70: VIBES[70], 80: VIBES[80] }
const colorOf = (s: R7Step, d: R7FilterData) =>
	s.kind === "services" ? "#10b981" : s.kind === "seen" ? "#2563eb" : s.kind === "mood" ? d.mood.hue : s.kind === "age" ? "#f59e0b" : VIBE[s.score ?? 70]

// ---------------------------------------------------------------------------------------------------------------
// The timeline: when each switch (or score threshold) changes, and when its result lands.

type Beat = { step: R7Step; index: number; on: number; result: number; drop: number; stamp: number }

function beats(steps: R7Step[]): { list: Beat[]; length: number } {
	const list: Beat[] = []
	let t = 1400
	steps.forEach((step, index) => {
		if (index === 0) {
			list.push({ step, index, on: 0, result: 250, drop: 0, stamp: 0 })
			return
		}
		const seen = step.kind === "seen"
		const score = step.kind === "score"
		const sub = score && step.score !== 60
		// Not seen yet stamps first; a score threshold shows the cut score before the poster drops.
		const drop = t + (seen ? 900 : score ? 600 : 320)
		const result = t + (seen ? 1200 : score ? 850 : 650)
		list.push({ step, index, on: t, result, drop, stamp: t + 250 })
		t += sub ? 1150 : seen ? 1950 : 1500
	})
	return { list, length: list[list.length - 1].result + 2300 }
}

// ---------------------------------------------------------------------------------------------------------------
// The posters: three slots. A title that still passes stays where it is; one that doesn't drops out (stamped Seen
// when Not seen yet removed it); the best-known title that passes and isn't shown deals into the free slot.

function slotsFor(steps: R7Step[]): (R7Title | null)[][] {
	const out: (R7Title | null)[][] = []
	const firstScore = steps.findIndex((s) => s.kind === "score")
	steps.forEach((s, i) => {
		const pass = new Set(s.titles.map((t) => t.key))
		const prev = out[i - 1] ?? Array(SLOTS).fill(null)
		const slots = prev.map((t) => (t && pass.has(t.key) ? t : null))
		const shown = new Set(slots.flatMap((t) => (t ? [t.key] : [])))
		const used = new Set(out.flat().flatMap((t) => (t ? [t.key] : [])))
		// The step before the score: one title in each band the score will cut (under 60, the 60s, the 70s).
		const bands = i === firstScore - 1 ? [[0, 59], [60, 69], [70, 79]] : null
		// A title whose rounded score sits on a threshold (79.6 shows as 80) would read wrong when 80+ cuts it: skip it.
		const pick = (from: R7Title[]) =>
			from.find((t) => !shown.has(t.key) && !used.has(t.key) && t.poster && ![60, 70, 80].includes(t.score ?? -1))
		for (let k = 0; k < SLOTS; k++) {
			if (bands) {
				const [lo, hi] = bands[k]
				const t = pick(s.titles.filter((x) => x.score != null && x.score >= lo && x.score <= hi))
				if (t) {
					slots[k] = t
					shown.add(t.key)
					continue
				}
			}
			if (slots[k]) continue
			const t = pick(s.titles)
			if (t) {
				slots[k] = t
				shown.add(t.key)
			}
		}
		out.push(slots)
	})
	return out
}

function Posters({ steps, list }: { steps: R7Step[]; list: Beat[] }) {
	const slots = slotsFor(steps)
	const last = steps.length - 1
	return (
		<div className="lp7f-posters">
			{slots.map((row, i) =>
				row.map((t, k) => {
					if (!t) return null
					const kept = i > 0 && slots[i - 1][k]?.key === t.key
					if (kept) return null // drawn by the step that brought it
					// How long it stays: until the first later step that doesn't keep it in this slot.
					let until = i + 1
					while (until <= last && slots[until][k]?.key === t.key) until++
					const leaves = until <= last ? list[until] : null
					const seen = leaves?.step.kind === "seen"
					const arrive = i === 0 ? 600 + k * 120 : list[i].result + k * 60
					return (
						<div key={`${i}-${k}-${t.key}`} className="lp7f-slot" style={{ "--k-slot": k } as CSSProperties}>
							<Timed at={i === 0 ? 0 : list[i].result}>
								<Leave at={leaves ? leaves.drop + k * 50 : undefined}>
									<div className="lp7f-m lp7f-m-deal" style={{ "--d": ms(arrive) } as CSSProperties}>
										<Poster title={t} />
									</div>
									{leaves && seen && (
										<span className="lp7f-stamp" style={{ "--d": ms(leaves.stamp + k * 60) } as CSSProperties}>
											Seen
										</span>
									)}
									{leaves && leaves.step.kind === "score" && t.score != null && (
										<span
											className="lp7f-cut"
											style={{ "--d": ms(leaves.on + 120), "--c": VIBE[leaves.step.score ?? 70] } as CSSProperties}
										>
											{t.score}
										</span>
									)}
								</Leave>
							</Timed>
						</div>
					)
				}),
			)}
		</div>
	)
}

function Poster({ title }: { title: R7Title }) {
	return (
		<div className="lp7f-poster-w">
			{title.poster ? (
				<img src={tmdbImageUrl(title.poster, "w342")} alt="" className="lp7f-poster" draggable={false} />
			) : (
				<span className="lp7f-poster lp7f-poster-none">{title.title}</span>
			)}
			{title.score != null && (
				<span className="lp7f-score" style={{ background: vibe(title.score) }}>
					{title.score}
				</span>
			)}
		</div>
	)
}

/** Shown from `at` on. */
function Timed({ at, children }: { at: number; children: ReactNode }) {
	return (
		<div className="lp7f-timed" style={{ "--a": ms(at) } as CSSProperties}>
			{children}
		</div>
	)
}
/** Falls away at `at` (if given). */
function Leave({ at, children }: { at?: number; children: ReactNode }) {
	if (at === undefined) return <>{children}</>
	return (
		<div className="lp7f-leave" style={{ "--x": ms(at) } as CSSProperties}>
			{children}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The number: each step's count rolls in as the one before lifts away.

const captionOf = (s: R7Step, d: R7FilterData, last: boolean) => {
	if (last) return "worth watching tonight"
	switch (s.kind) {
		case "all":
			return "movies and shows"
		case "services":
			return `on ${d.services.map((x) => (x.id === 9 ? "Prime Video" : x.name)).join(" and ")}`
		case "seen":
			return "you haven't seen yet"
		case "mood":
			return `${s.label.toLowerCase()} ones`
		case "age":
			return `rated ${s.label.replace(/^Up to /, "up to ")}`
		case "score":
			return `scored ${s.score} or more`
	}
}

function BigNumber({ list, d }: { list: Beat[]; d: R7FilterData }) {
	const last = list.length - 1
	return (
		<div className="lp7f-number">
			<div className="lp7f-number-n">
				{list.map((b, i) => (
					<Timed key={b.step.id} at={b.result}>
						<Lift at={i < last ? list[i + 1].result : undefined}>
							<div className="lp7f-m lp7f-m-roll" style={{ "--d": ms(b.result) } as CSSProperties}>
								<span className={i === last ? "lp7f-amber" : undefined}>{fmt(b.step.total)}</span>
							</div>
						</Lift>
					</Timed>
				))}
				<span className="lp7f-hold" aria-hidden="true">
					{fmt(list[0].step.total)}
				</span>
			</div>
			<div className="lp7f-number-caption">
				{list.map((b, i) => (
					<Timed key={b.step.id} at={b.result + 90}>
						<Lift at={i < last ? list[i + 1].result : undefined}>
							<div className="lp7f-m lp7f-m-roll" style={{ "--d": ms(b.result + 90) } as CSSProperties}>
								<span className={i === last ? "lp7f-amber" : undefined}>{captionOf(b.step, d, i === last)}</span>
							</div>
						</Lift>
					</Timed>
				))}
				<span className="lp7f-hold" aria-hidden="true">
					you haven't seen yet
				</span>
			</div>
		</div>
	)
}
function Lift({ at, children }: { at?: number; children: ReactNode }) {
	if (at === undefined) return <>{children}</>
	return (
		<div className="lp7f-lift" style={{ "--x": ms(at) } as CSSProperties}>
			{children}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The switches: a settings panel. Off at first; each lights in its own colour with a punch.

function Mark({ step, d }: { step: R7Step; d: R7FilterData }) {
	if (step.kind === "services")
		return (
			<span className="lp7f-logos">
				{d.services.map((s) => (s.logo ? <img key={s.id} src={tmdbImageUrl(s.logo, "w92")} alt="" /> : null))}
			</span>
		)
	if (step.kind === "mood") return <span className="lp7f-dot" style={{ background: d.mood.hue }} />
	const icon: Record<string, string> = {
		// Heroicons' eye-slash, as Discover's Not seen yet switch shows when on.
		seen: "M3.98 8.22A10.48 10.48 0 0 0 1.93 12C3.23 16.34 7.24 19.5 12 19.5c.99 0 1.95-.14 2.86-.39M6.23 6.23A10.45 10.45 0 0 1 12 4.5c4.76 0 8.77 3.16 10.07 7.5a10.52 10.52 0 0 1-4.29 5.77M6.23 6.23 3 3m3.23 3.23 3.65 3.65m7.89 7.89L21 21m-3.23-3.23-3.65-3.65m0 0a3 3 0 1 0-4.24-4.24m4.24 4.24L9.88 9.88",
		age: "M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z",
		score: "M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7L12 2Z",
	}
	return (
		<svg viewBox="0 0 24 24" className="lp7f-icon" aria-hidden="true">
			<path d={icon[step.kind]} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	)
}

/** A later colour for a lit switch (the score's next threshold): when, and which colour. */
type Relight = { on: number; color: string }

function Switch({
	rowOn,
	color,
	appear,
	children,
	value,
	relights = [],
}: { rowOn: number; color: string; appear: number; children: ReactNode; value?: ReactNode; relights?: Relight[] }) {
	return (
		<div className="lp7f-m lp7f-m-deal" style={{ "--d": ms(appear) } as CSSProperties}>
			<div className="lp7f-row" style={{ "--on": ms(rowOn), "--c": color } as CSSProperties}>
				{relights.map((r) => (
					<span key={r.on} className="lp7f-relight" style={{ "--on": ms(r.on), "--c": r.color } as CSSProperties} />
				))}
				{children}
				{value}
				<span className="lp7f-switch" aria-hidden="true">
					{relights.map((r) => (
						<span key={r.on} className="lp7f-switch-relight" style={{ "--on": ms(r.on), "--c": r.color } as CSSProperties} />
					))}
					<span className="lp7f-knob" />
				</span>
			</div>
		</div>
	)
}

function Panel({ list, d }: { list: Beat[]; d: R7FilterData }) {
	const rows = list.filter((b) => b.index > 0 && !(b.step.kind === "score" && b.step.score !== 60))
	const scores = list.filter((b) => b.step.kind === "score")
	return (
		<div className="lp7f-panel">
			{rows.map((b, r) => {
				const color = colorOf(b.step, d)
				if (b.step.kind !== "score")
					return (
						<Switch key={b.step.id} rowOn={b.on} color={color} appear={300 + r * 100}>
							<span className="lp7f-mark" style={{ "--c": color } as CSSProperties}>
								<Mark step={b.step} d={d} />
							</span>
							<span className="lp7f-label">{b.step.label}</span>
						</Switch>
					)
				// The score: one switch; its threshold counts up and its colour follows the vibe of the threshold.
				return (
					<Switch
						key="score"
						rowOn={b.on}
						color={color}
						appear={300 + r * 100}
						relights={scores.slice(1).map((s) => ({ on: s.on, color: VIBE[s.step.score ?? 70] }))}
						value={
							<span className="lp7f-value">
								{scores.map((s, i) => (
									<Timed key={s.step.id} at={s.on}>
										<Lift at={i < scores.length - 1 ? scores[i + 1].on : undefined}>
											<span
												className="lp7f-m lp7f-m-roll lp7f-value-n"
												style={{ "--d": ms(s.on), "--c": VIBE[s.step.score ?? 70] } as CSSProperties}
											>
												{s.step.score}+
											</span>
										</Lift>
									</Timed>
								))}
								<span className="lp7f-hold" aria-hidden="true">
									80+
								</span>
							</span>
						}
					>
						<span className="lp7f-mark lp7f-score-mark">
							{scores.map((s, i) => (
								<span
									key={s.step.id}
									className="lp7f-score-dot"
									style={{ "--on": ms(s.on), "--c": VIBE[s.step.score ?? 70], zIndex: i } as CSSProperties}
								/>
							))}
						</span>
						<span className="lp7f-label">GoodWatch score</span>
					</Switch>
				)
			})}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

function Words({ text, at, amber }: { text: string; at: number; amber: string[] }) {
	return (
		<h2 className="lp7f-h">
			{text.split(" ").map((w, i) => (
				<span key={i}>
					{i > 0 && " "}
					<span
						className={`lp7f-m lp7f-m-rise lp7f-word ${amber.includes(w.replace(/[.,!]/g, "")) ? "lp7f-amber" : ""}`}
						style={{ "--d": ms(at + i * 140) } as CSSProperties}
					>
						{w}
					</span>
				</span>
			))}
		</h2>
	)
}

export const filterData = (data: ClipProps["data"]) => (data.extra.r7filter ?? null) as R7FilterData | null

/** The clip's length for the lab, from the real steps. */
export const lengthOf = (d: R7FilterData | null) => (d ? beats(d.steps).length : 14500)

export function FilterPanel({ data }: ClipProps) {
	const d = filterData(data)
	if (!d) return <div className="lp7f" />
	const { list } = beats(d.steps)
	const seen = list.find((b) => b.step.kind === "seen")
	return (
		<div className="lp7f">
			<Words text="From everything to tonight." at={150} amber={["tonight"]} />
			<div className="lp7f-left">
				<Panel list={list} d={d} />
				{seen && (
					<div className="lp7f-m lp7f-m-rise lp7f-foot" style={{ "--d": ms(seen.on + 400) } as CSSProperties}>
						Not seen yet shown for an example member.
					</div>
				)}
			</div>
			<div className="lp7f-right">
				<BigNumber list={list} d={d} />
				<Posters steps={d.steps} list={list} />
			</div>
		</div>
	)
}
