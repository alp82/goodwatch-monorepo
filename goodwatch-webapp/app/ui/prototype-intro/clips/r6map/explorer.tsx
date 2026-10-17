// PROTOTYPE - throwaway. Round 6 Explorer clips (chapter 7), from round 5's explorer-combine: the map, faster, with
// the Explorer tutorial's pointer clicking each pick. The map holds three of the Explorer's groupings side by side
// (moods, themes, styles), so the picks are far apart and of different kinds. A tally counts the titles left after
// each click; the picked islands then merge into one, and the famous titles they share deal in. All counts and titles
// are real (r6map.server.ts).
import type { CSSProperties } from "react"
import type { R6Combo, R6Island, R6MapData } from "~/server/prototype-intro/r6map.server"
import type { ClipProps } from "../../clip"
import { BlobDefs, DEAL, GLIDE, Headline, Sea, fmt, img, play, spread } from "../r5map/kit"
import { Clicks, Island, pos } from "./kit"

const empty = <div className="lpc-r5map-root"><Sea /></div>
const REGIONS = [
	{ grouping: "mood", label: "Moods", cx: 17 },
	{ grouping: "theme", label: "Themes", cx: 50 },
	{ grouping: "style", label: "Styles", cx: 83 },
] as const
/** Where the map's regions sit, in cqw (y as cqw too: the stage is 56.25cqw tall). */
const CY = 29
const RX = 8.2
const RY = 7.4
/** The middle, where picks merge. */
const MID = { x: 50, y: 25 }

type Laid = { island: R6Island; x: number; y: number; w: number; rank: number }

/** Lays each grouping's islands out in its region, sized by title count, none overlapping. */
function layout(m: R6MapData): Laid[] {
	const max = Math.max(...m.islands.map((i) => i.count))
	const out: Laid[] = []
	REGIONS.forEach((r, g) => {
		const here = m.islands.filter((i) => i.grouping === r.grouping)
		const ws = here.map((i) => 4.6 + Math.sqrt(i.count / max) * 2.8)
		const spots = spread(
			here.map((i, n) => ({ x: i.x, y: i.y, w: ws[n] })),
			{ cx: r.cx, cy: CY, rx: RX, ry: RY },
		)
		here.forEach((island, n) => out.push({ island, x: spots[n].x, y: spots[n].y, w: ws[n], rank: g * 14 + n }))
	})
	return out
}

const named = (m: R6MapData, ref: R6Combo["of"][0]) => m.islands.find((i) => i.grouping === ref.grouping && i.id === ref.id)

/** Picks at: one click every `gap` ms from `first`. */
function timeline(n: number) {
	const first = 2200
	const gap = 1150
	const clicks = Array.from({ length: n }, (_, k) => first + k * gap)
	const last = clicks[n - 1]
	return { clicks, dim: last + 500, gather: last + 650, merge: last + 1500, head: last + 1450, posters: last + 2000, end: last + 5200 }
}

function Combine({ data, three }: ClipProps & { three: boolean }) {
	const m = (data.extra.r6map ?? null) as R6MapData | null
	const combo = m && (three ? m.three : m.two)
	if (!m || !combo) return empty
	const laid = layout(m)
	const picks = combo.of.map((ref) => laid.find((l) => l.island.grouping === ref.grouping && l.island.id === ref.id)).filter(Boolean) as Laid[]
	if (picks.length !== combo.of.length) return empty
	const t = timeline(picks.length)
	const isPick = (l: Laid) => picks.includes(l)
	const colors = picks.map((p) => p.island.color)
	const name = picks.map((p) => p.island.name).join(" + ")
	// Each pick, lifted, glides to its place around the middle, then into it.
	const around = (k: number) => {
		const spread = picks.length === 3 ? [-15, 0, 15][k] : [-10, 10][k]
		return { x: MID.x + spread, y: MID.y + (picks.length === 3 && k === 1 ? -3 : 0) }
	}
	return (
		<div className="lpc-r5map-root">
			<Sea />
			<BlobDefs />
			{/* The map. */}
			<div className="lpc-r5map-abs lpc-r5map-a" style={{ inset: 0, transformOrigin: "50% 52%", ...play(["lpc-r5map-cam-in", 0, 1800, "cubic-bezier(.16,1,.3,1)"]) }}>
				{REGIONS.map((r, g) => (
					<div key={r.grouping} className="lpc-r6map-at" style={{ ...pos({ x: r.cx, y: CY - RY - 6 }), zIndex: 2 }}>
						<div className="lpc-r6map-region lpc-r5map-a" style={play(["lpc-r5map-rise", 450 + g * 120, 700], ["lpc-r5map-fade-out", t.dim, 500])}>
							{r.label}
						</div>
					</div>
				))}
				{laid.map((l) => (
					<div key={`${l.island.grouping}:${l.island.id}`} className="lpc-r6map-at lpc-r6map-mid" style={pos(l)}>
						<div>
							<div
								className="lpc-r5map-a"
								style={play(
									["lpc-r5map-pop", 150 + l.rank * 32, 650, DEAL],
									isPick(l) ? ["lpc-r5map-fade-out", t.gather, 200] : ["lpc-r5map-dim", t.dim, 600],
								)}
							>
								<Island seed={l.island.id} name={l.island.name} colors={[l.island.color]} picture={img(l.island.picture, "w300")} w={l.w} />
							</div>
						</div>
					</div>
				))}
			</div>
			{/* The picks, on top: each lights up as it's clicked, then they gather in the middle and merge. */}
			{picks.map((p, k) => {
				const to = around(k)
				const glide = {
					"--tx": `${to.x - p.x}cqw`,
					"--ty": `${((to.y - p.y) * 16) / 9}cqh`,
					"--ts": "1.9",
				} as CSSProperties
				return (
					<div key={p.island.id} className="lpc-r6map-at lpc-r6map-mid" style={{ ...pos(p), zIndex: 5 }}>
						<div>
							<div className="lpc-r5map-a" style={play(["lpc-r5map-fade-in", t.clicks[k] + 40, 120], ["lpc-r6map-to", t.gather, 800, GLIDE], ["lpc-r5map-fade-out", t.merge - 250, 300], glide)}>
								<div className="lpc-r5map-a" style={play(["lpc-r6map-pick", t.clicks[k] + 60, 450, DEAL])}>
									<Island seed={p.island.id} name={p.island.name} colors={[p.island.color]} picture={img(p.island.picture, "w500")} w={p.w} ring={t.clicks[k] + 60} />
								</div>
							</div>
						</div>
					</div>
				)
			})}
			<Clicks points={picks.map((p, k) => ({ x: p.x, y: p.y, at: t.clicks[k] }))} leave={t.clicks[picks.length - 1] + 700} />
			{/* The merged island. */}
			<div className="lpc-r6map-at lpc-r6map-mid" style={{ ...pos(MID), zIndex: 6 }}>
				<div>
					<div className="lpc-r5map-a" style={play(["lpc-r5map-pop", t.merge, 850, DEAL])}>
						<Island
							seed={combo.of.map((r) => r.id).join("+")}
							name={name}
							sub={`${fmt(combo.counts.at(-1) ?? 0)} titles`}
							colors={colors}
							picture={img(combo.titles.find((x) => x.backdrop)?.backdrop, "w780")}
							w={three ? 27 : 24}
						/>
					</div>
				</div>
			</div>
			{/* Headlines and the tally. */}
			<Headline kicker="Explorer" text="A map of how movies *feel.*" delay={150} out={t.clicks[0] - 750} />
			<Tally m={m} combo={combo} at={t.clicks} out={t.head - 400} />
			<Headline kicker="Explorer" text={three ? "Mix three. *See* *what's* *shared.*" : "Mix two. *See* *what* *they* *share.*"} delay={t.head} />
			<div className="lpc-r5map-row" style={{ top: "65cqh" }}>
				{combo.titles.slice(0, three ? 7 : 6).map((x, k) => (
					<div key={x.key} className="lpc-r5map-a" style={{ width: "7.4cqw", ...play(["lpc-r5map-deal", t.posters + k * 110, 750, DEAL]) }}>
						<img className="lpc-r5map-poster" src={img(x.poster)} alt="" style={{ width: "100%" }} />
						<div className="lpc-r5map-cap">{x.title}</div>
					</div>
				))}
			</div>
		</div>
	)
}

/** After each click: the picked islands as chips, and the titles left, big. The previous step makes way. */
function Tally({ m, combo, at, out }: { m: R6MapData; combo: R6Combo; at: number[]; out: number }) {
	return (
		<div className="lpc-r6map-tally" aria-hidden="true">
			{combo.of.map((_, step) => {
				const next = at[step + 1]
				const leave: [string, number, number] = next ? ["lpc-r5map-fade-out", next + 80, 160] : ["lpc-r5map-out", out, 450]
				return (
					<div key={step} className="lpc-r6map-swap" style={{ top: 0 }}>
						<div className="lpc-r6map-chips">
							{combo.of.slice(0, step + 1).map((ref, k) => {
								const i = named(m, ref)
								return (
									<span
										key={ref.id}
										className="lpc-r6map-chip lpc-r5map-a"
										style={{ "--c": i?.color, ...play(k === step ? ["lpc-r5map-deal-up", at[step] + 120, 450, DEAL] : ["lpc-r5map-fade-in", at[step] + 100, 1], leave) } as CSSProperties}
									>
										<i />
										{i?.name}
										<span>{ref.grouping}</span>
									</span>
								)
							})}
						</div>
						<div className="lpc-r6map-tally-n lpc-r5map-a" style={play(["lpc-r5map-pop", at[step] + 180, 450, DEAL], leave)}>
							{fmt(combo.counts[step] ?? 0)}
							<small>titles</small>
						</div>
					</div>
				)
			})}
		</div>
	)
}

/** A. Two picks of different kinds (a mood and a style), far apart on the map. */
export const ExplorerClickTwo = ({ data }: ClipProps) => <Combine data={data} three={false} />
/** B. Three picks, one of each kind; the tally falls with each. */
export const ExplorerClickThree = ({ data }: ClipProps) => <Combine data={data} three />
