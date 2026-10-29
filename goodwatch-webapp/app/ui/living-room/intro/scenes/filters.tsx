import { MOOD_BY_KEY, isMoodKey } from "~/domain/moods"
// "Filters": from every title in the catalog to tonight's few, a switch at a time, each faster than the one before.
import type { CSSProperties, ReactNode } from "react"
import type {
	FilterData,
	FilterStep as FilterStepBase,
	FilterTitle,
} from "~/ui/living-room/intro/data"
import type { CatalogCounts } from "~/ui/living-room/intro/data"

type FilterStep = Omit<FilterStepBase, "kind"> & {
	kind: FilterStepBase["kind"] | "catalog"
}

/** Titles on Netflix or Prime Video in the US across the whole catalog (subscription, free or ads), Crate 2026-10-17. */
const CATALOG_ON_SERVICES = { country: "US", services: [8, 9], total: 43775 }
import type { SceneProps } from "~/ui/living-room/intro/scene"
import { tmdbImageUrl } from "~/utils/tmdb-image"

const moodName = (d: FilterData) =>
	isMoodKey(d.mood.key) ? MOOD_BY_KEY[d.mood.key].name : d.mood.name

const ms = (n: number) => `${Math.round(n)}ms`
const fmt = (n: number) => n.toLocaleString("en-US")
const SLOTS = 3

/** Discover's lit colours (ui/filter-bar): emerald for services, blue for Not seen yet, amber for the age limit. */
// The vibe colours (tailwind.css --color-vibe-*), by tens: Discover's score swatches.
const VIBES: Record<number, string> = {
	0: "#7f1d1d",
	10: "#991b1b",
	20: "#b91c1c",
	30: "#c2410c",
	40: "#d97706",
	50: "#ca8a04",
	60: "#a3a323",
	70: "#65a32d",
	80: "#16934a",
	90: "#15803d",
	100: "#166534",
}
const vibe = (score: number) =>
	VIBES[Math.min(100, Math.floor(score / 10) * 10)]
const VIBE: Record<number, string> = {
	60: VIBES[60],
	70: VIBES[70],
	80: VIBES[80],
}
const colorOf = (s: FilterStep, d: FilterData) =>
	s.kind === "services"
		? "#10b981"
		: s.kind === "seen"
			? "#2563eb"
			: s.kind === "mood"
				? d.mood.hue
				: s.kind === "age"
					? "#f59e0b"
					: VIBE[s.score ?? 70]

// ---------------------------------------------------------------------------------------------------------------
// The timeline: when each switch (or score threshold) changes, and when its result lands.

type Beat = {
	step: FilterStep
	index: number
	on: number
	result: number
	drop: number
	stamp: number
}

/** On-to-on gaps from the services switch on: about ×0.75 each; the score's thresholds tick fastest. */
const GAPS = [1400, 1050, 790, 590, 440, 340]
/** From a switch to its result landing, by kind: Not seen yet stamps first; later steps land quicker. */
const LAND: Record<string, number> = {
	services: 600,
	seen: 800,
	mood: 520,
	age: 480,
}
const SCORE_LAND = [500, 380, 360]
/** The hold on the final number, with a slow push-in; the next chapter's crossfade covers its last 800 ms. */
export const HOLD = 2600

function beats(steps: FilterStep[]): { list: Beat[]; length: number } {
	const list: Beat[] = []
	let t = 1100
	let scoreN = 0
	steps.forEach((step, index) => {
		if (index === 0) {
			list.push({ step, index, on: 0, result: 250, drop: 0, stamp: 0 })
			return
		}
		const seen = step.kind === "seen"
		const land =
			step.kind === "score"
				? SCORE_LAND[Math.min(scoreN++, SCORE_LAND.length - 1)]
				: (LAND[step.kind] ?? 520)
		const result = t + land
		// The outgoing poster falls only once its replacement has begun to land, so the slot is never empty.
		const drop = seen ? t + 500 : result - 100
		list.push({ step, index, on: t, result, drop, stamp: t + 200 })
		t += GAPS[Math.min(index - 1, GAPS.length - 1)]
	})
	return { list, length: list[list.length - 1].result + HOLD }
}

// ---------------------------------------------------------------------------------------------------------------
// The posters: three slots. A title that still passes stays where it is; one that doesn't drops out (stamped Seen
// when Not seen yet removed it); the best-known title that passes and isn't shown deals into the free slot.

function slotsFor(steps: FilterStep[]): (FilterTitle | null)[][] {
	const out: (FilterTitle | null)[][] = []
	const firstScore = steps.findIndex((s) => s.kind === "score")
	steps.forEach((s, i) => {
		const pass = new Set(s.titles.map((t) => t.key))
		const prev = out[i - 1] ?? Array(SLOTS).fill(null)
		// The opening floors keep every famous title, so each shows three new ones: every step changes the posters.
		const fresh = s.kind === "catalog" || s.kind === "all"
		const slots = prev.map((t) => (!fresh && t && pass.has(t.key) ? t : null))
		const shown = new Set(slots.flatMap((t) => (t ? [t.key] : [])))
		const used = new Set(out.flat().flatMap((t) => (t ? [t.key] : [])))
		// The step before the score: one title in each band the score will cut (under 60, the 60s, the 70s).
		const bands =
			i === firstScore - 1
				? [
						[0, 59],
						[60, 69],
						[70, 79],
					]
				: null
		// A title whose rounded score sits on a threshold (79.6 shows as 80) would read wrong when 80+ cuts it: skip it.
		const pick = (from: FilterTitle[]) =>
			from.find(
				(t) =>
					!shown.has(t.key) &&
					!used.has(t.key) &&
					t.poster &&
					![60, 70, 80].includes(t.score ?? -1),
			)
		for (let k = 0; k < SLOTS; k++) {
			if (bands) {
				const [lo, hi] = bands[k]
				const t = pick(
					s.titles.filter(
						(x) => x.score != null && x.score >= lo && x.score <= hi,
					),
				)
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

function Posters({ steps, list }: { steps: FilterStep[]; list: Beat[] }) {
	const slots = slotsFor(steps)
	const last = steps.length - 1
	return (
		<div className="intro-switch-posters">
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
						<div
							key={`${i}-${k}-${t.key}`}
							className="intro-switch-slot"
							style={{ "--k-slot": k } as CSSProperties}
						>
							<Timed at={i === 0 ? 0 : list[i].result}>
								<Leave at={leaves ? leaves.drop + k * 50 : undefined}>
									<div
										className="intro-switch-m intro-switch-m-deal"
										style={{ "--d": ms(arrive) } as CSSProperties}
									>
										<Poster title={t} />
									</div>
									{leaves && seen && (
										<span
											className="intro-switch-stamp"
											style={
												{ "--d": ms(leaves.stamp + k * 60) } as CSSProperties
											}
										>
											Seen
										</span>
									)}
									{leaves &&
										leaves.step.kind === "score" &&
										t.score != null && (
											<span
												className="intro-switch-cut"
												style={
													{
														"--d": ms(leaves.on + 120),
														"--c": VIBE[leaves.step.score ?? 70],
													} as CSSProperties
												}
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

function Poster({ title }: { title: FilterTitle }) {
	return (
		<div className="intro-switch-poster-w">
			{title.poster ? (
				<img
					src={tmdbImageUrl(title.poster, "w342")}
					alt=""
					className="intro-switch-poster"
					draggable={false}
				/>
			) : (
				<span className="intro-switch-poster intro-switch-poster-none">
					{title.title}
				</span>
			)}
			{title.score != null && (
				<span
					className="intro-switch-score"
					style={{ background: vibe(title.score) }}
				>
					{title.score}
				</span>
			)}
		</div>
	)
}

/** Shown from `at` on. */
function Timed({ at, children }: { at: number; children: ReactNode }) {
	return (
		<div
			className="intro-switch-timed"
			style={{ "--a": ms(at) } as CSSProperties}
		>
			{children}
		</div>
	)
}
/** Falls away at `at` (if given). */
function Leave({ at, children }: { at?: number; children: ReactNode }) {
	if (at === undefined) return <>{children}</>
	return (
		<div
			className="intro-switch-leave"
			style={{ "--x": ms(at) } as CSSProperties}
		>
			{children}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The number: each step's count rolls in as the one before lifts away.

const captionOf = (s: FilterStep, d: FilterData, last: boolean) => {
	if (last) return "worth watching tonight"
	switch (s.kind) {
		case "catalog":
			return "titles in our catalog"
		case "all":
			return "movies and shows to choose from"
		case "services":
			return `on ${d.services.map((x) => (x.id === 9 ? "Prime Video" : x.name)).join(" and ")}`
		case "seen":
			return "you haven't seen yet"
		case "mood":
			return `${moodName(d).toLowerCase()} ones`
		case "age":
			return `rated ${s.label.replace(/^Up to /, "up to ")}`
		case "score":
			return `scored ${s.score} or more`
	}
}

function BigNumber({ list, d }: { list: Beat[]; d: FilterData }) {
	const last = list.length - 1
	return (
		<div className="intro-switch-number">
			<div className="intro-switch-number-n">
				{list.map((b, i) => (
					<Timed key={b.step.id} at={b.result}>
						<Lift at={i < last ? list[i + 1].result : undefined}>
							<div
								className="intro-switch-m intro-switch-m-roll"
								style={{ "--d": ms(b.result) } as CSSProperties}
							>
								<span
									className={`${i === last ? "intro-switch-amber" : ""} ${b.step.total >= 100000 ? "intro-switch-long" : ""}`}
								>
									{fmt(b.step.total)}
								</span>
							</div>
						</Lift>
					</Timed>
				))}
				<span className="intro-switch-hold" aria-hidden="true">
					{fmt(list[0].step.total)}
				</span>
			</div>
			<div className="intro-switch-number-caption">
				{list.map((b, i) => (
					<Timed key={b.step.id} at={b.result + 90}>
						<Lift at={i < last ? list[i + 1].result : undefined}>
							<div
								className="intro-switch-m intro-switch-m-roll"
								style={{ "--d": ms(b.result + 90) } as CSSProperties}
							>
								<span className={i === last ? "intro-switch-amber" : undefined}>
									{captionOf(b.step, d, i === last)}
								</span>
							</div>
						</Lift>
					</Timed>
				))}
				<span className="intro-switch-hold" aria-hidden="true">
					you haven't seen yet
				</span>
			</div>
		</div>
	)
}
function Lift({ at, children }: { at?: number; children: ReactNode }) {
	if (at === undefined) return <>{children}</>
	return (
		<div
			className="intro-switch-lift"
			style={{ "--x": ms(at) } as CSSProperties}
		>
			{children}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The switches: a settings panel. Off at first; each lights in its own colour with a punch.

function Mark({ step, d }: { step: FilterStep; d: FilterData }) {
	if (step.kind === "services")
		return (
			<span className="intro-switch-logos">
				{d.services.map((s) =>
					s.logo ? (
						<img key={s.id} src={tmdbImageUrl(s.logo, "w92")} alt="" />
					) : null,
				)}
			</span>
		)
	if (step.kind === "mood")
		return (
			<span className="intro-switch-dot" style={{ background: d.mood.hue }} />
		)
	const icon: Record<string, string> = {
		// Heroicons' eye-slash, as Discover's Not seen yet switch shows when on.
		seen: "M3.98 8.22A10.48 10.48 0 0 0 1.93 12C3.23 16.34 7.24 19.5 12 19.5c.99 0 1.95-.14 2.86-.39M6.23 6.23A10.45 10.45 0 0 1 12 4.5c4.76 0 8.77 3.16 10.07 7.5a10.52 10.52 0 0 1-4.29 5.77M6.23 6.23 3 3m3.23 3.23 3.65 3.65m7.89 7.89L21 21m-3.23-3.23-3.65-3.65m0 0a3 3 0 1 0-4.24-4.24m4.24 4.24L9.88 9.88",
		age: "M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z",
		score:
			"M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7L12 2Z",
	}
	return (
		<svg viewBox="0 0 24 24" className="intro-switch-icon" aria-hidden="true">
			<path
				d={icon[step.kind]}
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
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
}: {
	rowOn: number
	color: string
	appear: number
	children: ReactNode
	value?: ReactNode
	relights?: Relight[]
}) {
	return (
		<div
			className="intro-switch-m intro-switch-m-deal"
			style={{ "--d": ms(appear) } as CSSProperties}
		>
			<div
				className="intro-switch-row"
				style={{ "--on": ms(rowOn), "--c": color } as CSSProperties}
			>
				{relights.map((r) => (
					<span
						key={r.on}
						className="intro-switch-relight"
						style={{ "--on": ms(r.on), "--c": r.color } as CSSProperties}
					/>
				))}
				{children}
				{value}
				<span className="intro-switch-switch" aria-hidden="true">
					{relights.map((r) => (
						<span
							key={r.on}
							className="intro-switch-switch-relight"
							style={{ "--on": ms(r.on), "--c": r.color } as CSSProperties}
						/>
					))}
					<span className="intro-switch-knob" />
				</span>
			</div>
		</div>
	)
}

function Panel({ list, d }: { list: Beat[]; d: FilterData }) {
	const rows = list.filter(
		(b) => b.index > 0 && !(b.step.kind === "score" && b.step.score !== 60),
	)
	const scores = list.filter((b) => b.step.kind === "score")
	return (
		<div className="intro-switch-panel">
			{rows.map((b, r) => {
				const color = colorOf(b.step, d)
				if (b.step.kind !== "score")
					return (
						<Switch
							key={b.step.id}
							rowOn={b.on}
							color={color}
							appear={300 + r * 100}
						>
							<span
								className="intro-switch-mark"
								style={{ "--c": color } as CSSProperties}
							>
								<Mark step={b.step} d={d} />
							</span>
							<span className="intro-switch-label">
								{b.step.kind === "mood" ? moodName(d) : b.step.label}
							</span>
						</Switch>
					)
				// The score: one switch; its threshold counts up and its colour follows the vibe of the threshold.
				return (
					<Switch
						key="score"
						rowOn={b.on}
						color={color}
						appear={300 + r * 100}
						relights={scores
							.slice(1)
							.map((s) => ({ on: s.on, color: VIBE[s.step.score ?? 70] }))}
						value={
							<span className="intro-switch-value">
								{scores.map((s, i) => (
									<Timed key={s.step.id} at={s.on}>
										<Lift
											at={i < scores.length - 1 ? scores[i + 1].on : undefined}
										>
											<span
												className="intro-switch-m intro-switch-m-roll intro-switch-value-n"
												style={
													{
														"--d": ms(s.on),
														"--c": VIBE[s.step.score ?? 70],
													} as CSSProperties
												}
											>
												{s.step.score}+
											</span>
										</Lift>
									</Timed>
								))}
								<span className="intro-switch-hold" aria-hidden="true">
									80+
								</span>
							</span>
						}
					>
						<span className="intro-switch-mark intro-switch-score-mark">
							{scores.map((s, i) => (
								<span
									key={s.step.id}
									className="intro-switch-score-dot"
									style={
										{
											"--on": ms(s.on),
											"--c": VIBE[s.step.score ?? 70],
											zIndex: i,
										} as CSSProperties
									}
								/>
							))}
						</span>
						<span className="intro-switch-label">GoodWatch score</span>
					</Switch>
				)
			})}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

function Words({
	text,
	at,
	amber,
}: { text: string; at: number; amber: string[] }) {
	return (
		<h2 className="intro-switch-h">
			{text.split(" ").map((w, i) => (
				<span key={i}>
					{i > 0 && " "}
					<span
						className={`intro-switch-m intro-switch-m-rise intro-switch-word ${amber.includes(w.replace(/[.,!]/g, "")) ? "intro-switch-amber" : ""}`}
						style={{ "--d": ms(at + i * 140) } as CSSProperties}
					>
						{w}
					</span>
				</span>
			))}
		</h2>
	)
}

/**
 * The snapshot's real steps (Discover's counts), opened by the whole catalog. The services step and Not seen yet count
 * the whole catalog when the snapshot's country and services match CATALOG_ON_SERVICES; otherwise the scene opens on
 * Discover's own count, so no number ever goes up.
 */
export const filterData = (data: SceneProps["data"]) => {
	const d = (data.extra.filters ?? null) as FilterData | null
	const c = (data.extra.catalog ?? null) as CatalogCounts | null
	if (!d) return null
	const [all, services, seen, ...rest] = d.steps as FilterStep[]
	const match =
		c &&
		d.country === CATALOG_ON_SERVICES.country &&
		d.services.map((x) => x.id).join() ===
			CATALOG_ON_SERVICES.services.join() &&
		services?.kind === "services" &&
		seen?.kind === "seen"
	if (!match)
		return {
			...d,
			steps: [
				{ ...all, label: "Everything" },
				services,
				seen,
				...rest,
			] as FilterStepBase[],
		}
	const onServices = CATALOG_ON_SERVICES.total
	const seenOff = services.total - seen.total
	const steps: FilterStep[] = [
		{
			...all,
			id: "catalog",
			kind: "catalog",
			label: "Everything",
			total: c.movies + c.shows,
			titles: all.titles,
		},
		{ ...services, total: onServices },
		{ ...seen, total: onServices - seenOff },
		...rest,
	]
	return { ...d, steps: steps as FilterStepBase[] }
}

export function Filters({ data }: SceneProps) {
	const d = filterData(data)
	if (!d) return <div className="intro-switch" />
	const { list } = beats(d.steps as FilterStep[])
	const seen = list.find((b) => b.step.kind === "seen")
	const last = list[list.length - 1].result
	return (
		<div
			className="intro-switch"
			// The hold on the final number keeps a slow push-in: never a frozen frame.
			style={{
				transformOrigin: "60% 50%",
				animation: `intro-filters-drift calc(${HOLD}ms * var(--k)) linear calc(${last}ms * var(--k)) both`,
			}}
		>
			<Words text="From everything to tonight." at={150} amber={["tonight"]} />
			<div className="intro-switch-left">
				<Panel list={list} d={d} />
				{seen && (
					<div
						className="intro-switch-m intro-switch-m-rise intro-switch-foot"
						style={{ "--d": ms(seen.on + 400) } as CSSProperties}
					>
						Not seen yet shown for an example member.
					</div>
				)}
			</div>
			<div className="intro-switch-right">
				<BigNumber list={list} d={d} />
				<Posters steps={d.steps} list={list} />
			</div>
		</div>
	)
}
