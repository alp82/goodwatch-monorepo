// PROTOTYPE - throwaway. Round 5, chapter 6 (filters). Real Discover counts for a guest on Netflix and Prime Video,
// narrowed by the filters GoodWatch is good at; the posters are the best-known titles that pass each step.
// "Not seen yet" is for an example member who has seen the 150 best-known titles: those posters get a Seen stamp
// and fall out of the grid.
import type { CSSProperties } from "react"
import type { R5FilterData, R5Path, R5Step } from "~/server/prototype-intro/r5filter.server"
import type { ClipProps } from "../../clip"
import { Chip, Count, Grid, Poster, Window, Words, fmt, r5Data } from "./kit"

/** What the count means after each kind of step. */
const caption = (step: R5Step, data: R5FilterData, last: boolean) => {
	if (last) return "worth watching tonight"
	switch (step.kind) {
		case "services":
			return `titles on ${data.services.map((s) => (s.id === 9 ? "Prime Video" : s.name)).join(" and ")}`
		case "seen":
			return "you haven't seen yet"
		case "mood":
			return `${step.chip.toLowerCase()} ones`
		case "age":
			return `rated ${step.chip.replace(/^Up to /, "up to ")}`
		case "score":
			return "scored 70 or more"
		default:
			return "left"
	}
}

const seenSet = (data: R5FilterData) => new Set(data.seen.titles.map((t) => t.key))

/** For a step, the keys of the posters the step before showed that this one doesn't: the ones you've seen. */
const goneOnSeen = (path: R5Path) => {
	const i = path.steps.findIndex((s) => s.kind === "seen")
	if (i < 1) return new Set<string>()
	const kept = new Set(path.steps[i].titles.map((t) => t.key))
	return new Set(path.steps[i - 1].titles.filter((t) => !kept.has(t.key)).map((t) => t.key))
}

function Empty() {
	return <div className="lpc-r5filter" />
}

// ---------------------------------------------------------------------------------------------------------------
// A. Tally: the big number counts down on the left as chips switch on; a grid of small posters follows on the right.
const TALLY_T = [900, 2900, 5100, 6800, 8500]
const TALLY_SWAP = 300
const TALLY_SEEN = { stamp: 250, swap: 1350 }

export function Tally({ data }: ClipProps) {
	const d = r5Data(data)
	if (!d) return <Empty />
	return <TallyOf d={d} path={d.tonight} title="From everything to tonight." amber={["tonight"]} />
}

export function TallyOf({ d, path, title, amber }: { d: R5FilterData; path: R5Path; title: string; amber: string[] }) {
	const steps = path.steps
	const gone = goneOnSeen(path)
	// When each step's count and grid arrive: a beat after its chip, longer for Not seen yet (the stamps go first).
	const swap = steps.map((s, i) => TALLY_T[i] + (i === 0 ? 0 : s.kind === "seen" ? TALLY_SEEN.swap : TALLY_SWAP))
	return (
		<div className="lpc-r5filter">
			<div className="lpc-r5filter-left">
				<Window from={0} enter="rise">
					<div className="lpc-r5filter-kicker">Filters</div>
				</Window>
				<Words text={title} at={150} amber={amber} />
				<div className="lpc-r5filter-countbox">
					<Count steps={steps} times={swap} />
					<div className="lpc-r5filter-caption">
						{steps.map((s, i) => (
							<Window key={s.id} from={swap[i] + 120} to={swap[i + 1]} enter="rise" leave="lift" className={i === steps.length - 1 ? "lpc-r5filter-amber" : ""}>
								{s.kind === "seen" ? `${caption(s, d, false)} (−${fmt(steps[i - 1].total - s.total)})` : caption(s, d, i === steps.length - 1)}
							</Window>
						))}
					</div>
				</div>
				<div className="lpc-r5filter-chips">
					{steps.map((s, i) => (
						<Chip key={s.id} step={s} data={d} at={TALLY_T[i]} />
					))}
				</div>
			</div>
			<div className="lpc-r5filter-right">
				{steps.map((s, i) => (
					<Grid
						key={s.id}
						titles={s.titles}
						from={swap[i]}
						to={swap[i + 1]}
						cols={5}
						rows={3}
						seen={steps[i + 1]?.kind === "seen" ? gone : undefined}
						stampAt={steps[i + 1]?.kind === "seen" ? TALLY_T[i + 1] + TALLY_SEEN.stamp : undefined}
					/>
				))}
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// B. Trade: each filter arrives full screen, chip and number huge; then the number steps aside for the grid it
// leaves. The last number comes back big, in amber.
const TRADE_FIRST = 700
const TRADE_EACH = 2600
/** How long a filter holds full screen. */
const TRADE_BIG = 1200
/** Its grid arrives once the big number has shrunk away, and leaves this long before the next filter lands. */
const TRADE_GRID_IN = 450
const TRADE_GRID_OUT = 450

export function Trade({ data }: ClipProps) {
	const d = r5Data(data)
	if (!d) return <Empty />
	const steps = d.tonight.steps
	const gone = goneOnSeen(d.tonight)
	const t = steps.map((_, i) => TRADE_FIRST + i * TRADE_EACH)
	const end = TRADE_FIRST + steps.length * TRADE_EACH
	const last = steps[steps.length - 1]
	return (
		<div className="lpc-r5filter">
			{steps.map((s, i) => (
				<div key={s.id} className="lpc-r5filter-stack">
					{/* The filter, full screen. */}
					<Window from={t[i]} to={t[i] + TRADE_BIG} enter="pop" leave="shrink" className="lpc-r5filter-center">
						<div className="lpc-r5filter-bigstep">
							<Chip step={s} data={d} at={t[i]} />
							<div className="lpc-r5filter-bignum">{fmt(s.total)}</div>
							<div className="lpc-r5filter-caption" style={{ height: "auto" }}>
								<span style={{ position: "static" }}>{caption(s, d, false)}</span>
							</div>
						</div>
					</Window>
					{/* Then its grid, with the number small in the corner. */}
					<Window from={t[i] + TRADE_BIG + TRADE_GRID_IN} to={(i < steps.length - 1 ? t[i + 1] : end) - TRADE_GRID_OUT} enter="fade" leave="fade">
						<div className="lpc-r5filter-corner">
							<div className="lpc-r5filter-chips">
								{steps.slice(0, i + 1).map((c) => (
									<Chip key={c.id} step={c} data={d} at={c.id === s.id ? t[i] + TRADE_BIG + TRADE_GRID_IN : 0} />
								))}
							</div>
							<div className="lpc-r5filter-count" style={{ height: "auto" }}>
								{fmt(s.total)}
							</div>
						</div>
					</Window>
					<div className="lpc-r5filter-tradegrid">
						<Grid
							titles={s.titles}
							from={t[i] + TRADE_BIG + TRADE_GRID_IN}
							to={(i < steps.length - 1 ? t[i + 1] : end) - TRADE_GRID_OUT}
							cols={9}
							rows={2}
							seen={steps[i + 1]?.kind === "seen" ? gone : undefined}
							stampAt={steps[i + 1]?.kind === "seen" ? t[i + 1] - 1500 : undefined}
							stagger={30}
						/>
					</div>
				</div>
			))}
			{/* The answer, big and amber. */}
			<Window from={end + 150} enter="pop" className="lpc-r5filter-center">
				<div className="lpc-r5filter-bignum lpc-r5filter-amber">{fmt(last.total)}</div>
				<div className="lpc-r5filter-caption" style={{ height: "auto", marginTop: "1cqh" }}>
					<span style={{ position: "static" }}>worth watching tonight, out of {fmt(steps[0].total)}</span>
				</div>
			</Window>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// C. Seen it? Gone. A wall of the best-known titles; Not seen yet stamps the ones you've seen and they fall away.
// Then mood, age and score narrow it to tonight, the count shrinking in the corner.
const UNSEEN_T = [800, 3000, 6000, 7500, 9000]

export function Unseen({ data }: ClipProps) {
	const d = r5Data(data)
	if (!d) return <Empty />
	const steps = d.tonight.steps
	const gone = goneOnSeen(d.tonight)
	const swap = steps.map((s, i) => UNSEEN_T[i] + (i === 0 ? 0 : s.kind === "seen" ? 1500 : 300))
	return (
		<div className="lpc-r5filter lpc-r5filter-unseen">
			<div className="lpc-r5filter-corner">
				<div>
					<Window from={0} enter="rise">
						<div className="lpc-r5filter-kicker">Not seen yet</div>
					</Window>
					<Words text="Seen it? It's gone." at={150} amber={["gone"]} />
				</div>
				<div style={{ textAlign: "right" }}>
					<Count steps={steps} times={swap} className="lpc-r5filter-count-right" />
					<div className="lpc-r5filter-caption lpc-r5filter-hide-phone" style={{ width: "34cqw", marginLeft: "auto" }}>
						{steps.map((s, i) => (
							<Window key={s.id} from={swap[i] + 120} to={swap[i + 1]} style={{ right: 0, left: "auto" }} className={i === steps.length - 1 ? "lpc-r5filter-amber" : ""}>
								{s.kind === "seen" ? `${caption(s, d, false)} (−${fmt(steps[i - 1].total - s.total)})` : caption(s, d, i === steps.length - 1)}
							</Window>
						))}
					</div>
				</div>
			</div>
			<div className="lpc-r5filter-tradegrid" style={{ top: "33cqh" }}>
				{steps.map((s, i) => (
					<Grid
						key={s.id}
						titles={s.titles}
						from={swap[i]}
						to={swap[i + 1]}
						cols={10}
						rows={2}
						seen={steps[i + 1]?.kind === "seen" ? gone : undefined}
						stampAt={steps[i + 1]?.kind === "seen" ? UNSEEN_T[i + 1] + 200 : undefined}
						stagger={35}
					/>
				))}
			</div>
			<div className="lpc-r5filter-chips lpc-r5filter-chips-row" style={{ position: "absolute", left: "5cqw", right: "5cqw", top: "22cqh" }}>
				{steps.map((s, i) => (
					<Chip key={s.id} step={s} data={d} at={UNSEEN_T[i]} />
				))}
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// D. Exploration: three evenings side by side, each narrowing its own way at the same time.
const LANE_T = [1100, 2500, 3900, 5300, 6700]

export function Evenings({ data }: ClipProps) {
	const d = r5Data(data)
	if (!d) return <Empty />
	const lanes: { name: string; path: R5Path }[] = [
		{ name: "Tonight", path: d.tonight },
		{ name: "Family night", path: d.family },
		{ name: "Date night", path: d.date },
	]
	return (
		<div className="lpc-r5filter">
			<div style={{ position: "absolute", left: "4cqw", top: "6cqh" }}>
				<Window from={0} enter="rise">
					<div className="lpc-r5filter-kicker">Filters</div>
				</Window>
				<Words text="Every evening, its own list." at={150} amber={["own"]} />
			</div>
			<div className="lpc-r5filter-lanes">
				{lanes.map((lane, l) => {
					const times = LANE_T.map((t) => t + l * 220)
					const last = lane.path.steps[lane.path.steps.length - 1]
					return (
						<Window key={lane.name} from={500 + l * 160} enter="deal" className="lpc-r5filter-lane">
							<h3>{lane.name}</h3>
							<Count steps={lane.path.steps} times={times} />
							<div className="lpc-r5filter-chips">
								{lane.path.steps.slice(2).map((s, i) => (
									<Chip key={s.id} step={s} data={d} at={times[i + 2]} />
								))}
							</div>
							<div className="lpc-r5filter-lane-posters">
								{last.titles.slice(0, 3).map((t, i) => (
									<div key={t.key} className="lpc-r5filter-e lpc-r5filter-e-deal" style={{ "--d": `${times[4] + 400 + i * 120}ms` } as CSSProperties}>
										<Poster title={t} />
									</div>
								))}
							</div>
						</Window>
					)
				})}
			</div>
		</div>
	)
}
