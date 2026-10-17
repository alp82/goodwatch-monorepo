// PROTOTYPE - throwaway. Round 9 Explorer clip (chapter 7): round 8's explorer-fly, retimed for rhythm. The owner:
// "cursor should point as soon as the first island lands while the others are still moving (these kind of things
// improve the rhythm and overall natural feel)", and no pauses between scenes. So the pointer sets off for Magical as
// soon as it has landed, while the other islands still sweep in; the second click follows promptly; the scene keeps a
// slow push-in while the shared titles are read, then the camera flies on into the merge. Everything else is round 8.
//
// PROTOTYPE - throwaway. Round 8 Explorer clip (chapter 7), a copy of round 7's explorer-few. The owner: "good.
// island presentation could be nicer, some kind of zoom or fly entry/exit transition". So the camera flies down onto
// the map (the map rises in as the islands sweep in past the camera and settle), and at the end it flies into the
// merged island and the shared titles until only the sea is left. Everything in between is round 7's clip.
//
// Round 7 Explorer clip (chapter 7), from round 6's explorer-click2. The owner: "too many islands,
// less is more, but keep the different categories. the combined text needs more padding, so make it bigger". So the
// map shows five well-known islands per grouping (moods, themes, styles), bigger and readable, and the merged island
// is larger, with room around its name. The click pointer and the pace stay. Counts and titles are real (r6map.server.ts).
import type { CSSProperties } from "react"
import type { R6Combo, R6Island, R6MapData } from "~/server/prototype-intro/r6map.server"
import type { ClipProps } from "../../clip"
import { BlobDefs, DEAL, GLIDE, Headline, Sea, blobPath, fmt, img, play } from "../r5map/kit"
import { Clicks, pos } from "../r6map/kit"
import { useId } from "react"
import "../r9b.css"

const empty = <div className="lpc-r5map-root"><Sea /></div>

/**
 * Five islands per grouping: the picks, then friendly, well-known ones. A static choice, so the map stays calm and
 * every name reads.
 */
const KEEP: Record<string, string[]> = {
	mood: ["magical", "funny", "thrilling", "cozy", "romantic"],
	theme: ["fantasy", "family", "mystery", "future", "growing-up"],
	style: ["spectacle", "fast-paced", "stylized", "animated", "nonlinear"],
}
const REGIONS = [
	{ grouping: "mood", label: "Moods", cx: 17 },
	{ grouping: "theme", label: "Themes", cx: 50 },
	{ grouping: "style", label: "Styles", cx: 83 },
] as const
/** Where the regions sit, in cqw (y as cqw too: the stage is 56.25cqw tall). */
const CY = 30.5
const RY = 7.6
/** The middle, where the picks merge. */
const MID = { x: 50, y: 23.2 }
const MERGED_W = 31
/** When the camera flies into the merged island: the shared titles have dealt in and held about a second. */
export const EXIT = 6700
/** The fly-out takes 800 ms; the next chapter crossfades in over it. */
export const EXPLORER_FLY_R9_MS = 7600

type Laid = { island: R6Island; x: number; y: number; w: number; rank: number }

const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, "-")

/**
 * A fixed, calm layout per region: two islands on top, one in the middle (the pick, when the region has one), two
 * below. The data's own positions let islands drift across region borders and off the stage.
 */
const SPOTS = [
	{ x: 0, y: 0 },
	{ x: -5.7, y: -7.6 },
	{ x: 5.7, y: -7.6 },
	{ x: -5.7, y: 7.6 },
	{ x: 5.7, y: 7.6 },
]

function layout(m: R6MapData, picks: R6Combo["of"]): Laid[] {
	const out: Laid[] = []
	REGIONS.forEach((r, g) => {
		const all = m.islands.filter((i) => i.grouping === r.grouping)
		const pick = picks.find((p) => p.grouping === r.grouping)?.id
		const keep = KEEP[r.grouping]
		const has = (i: R6Island, id: string) => i.id === id || keyOf(i.name) === id
		// The pick (or the region's first) in the middle, then the rest in the KEEP order.
		const order = [pick ?? keep[0], ...keep.filter((id) => id !== (pick ?? keep[0]))]
		const here = order.flatMap((id) => all.find((i) => has(i, id)) ?? []).slice(0, 5)
		const max = Math.max(...here.map((i) => i.count))
		here.forEach((island, n) => {
			const w = 8.6 + Math.sqrt(island.count / max) * 1.6
			out.push({ island, x: r.cx + SPOTS[n].x, y: CY + SPOTS[n].y, w, rank: g * 5 + n })
		})
	})
	return out
}

const named = (m: R6MapData, ref: R6Combo["of"][0]) => m.islands.find((i) => i.grouping === ref.grouping && i.id === ref.id)

/**
 * The first click comes as soon as its island has landed (the pointer sets off at ~850 ms, while the rest still sweep
 * in); the second follows 850 ms later. Everything after the clicks follows a beat sooner than round 8.
 */
function timeline(n: number) {
	const first = 1500
	const gap = 850
	const clicks = Array.from({ length: n }, (_, k) => first + k * gap)
	const last = clicks[n - 1]
	return {
		clicks,
		// When the tally shows each step: the first waits until the opening headline has started to leave.
		show: clicks.map((c, k) => (k === 0 ? Math.max(c + 120, HEAD_OUT + 120) : c + 120)),
		dim: last + 450,
		gather: last + 550,
		merge: last + 1350,
		head: last + 1300,
		posters: last + 1800,
	}
}
/** The opening headline leaves just after the first click. */
const HEAD_OUT = 1850

/**
 * An island as the Explorer draws it, one colour or several. Its name is set at `text` cqw (scaled up on the phone
 * TV by `--lpc-r7map-isl`), inside a padded box so it never touches the rim.
 */
function Island({
	seed,
	name,
	sub,
	colors,
	picture,
	w,
	text,
	pad = 12,
	ring,
	merged = false,
}: {
	seed: string
	name?: string
	sub?: string
	colors: string[]
	picture?: string | null
	w: number
	text: number
	/** Horizontal padding inside the island, in % of its width. */
	pad?: number
	ring?: number
	/** The merged island: its name keeps its size on the phone TV, where the box is narrow. */
	merged?: boolean
}) {
	const id = useId().replace(/:/g, "")
	const d = blobPath(seed)
	const rim = colors.length > 1 ? `url(#g${id})` : colors[0]
	const band = 100 / colors.length
	return (
		<div className="lpc-r6map-island" style={{ width: `${w}cqw`, height: `${w * 0.7}cqw` }}>
			<svg viewBox="-14 -14 128 98" className="lpc-r6map-island-svg" aria-hidden="true">
				<defs>
					<clipPath id={`c${id}`}>
						<path d={d} />
					</clipPath>
					{colors.length > 1 && (
						<linearGradient id={`g${id}`} x1="0" x2="1" y1="0" y2="0">
							{colors.map((c, k) => (
								<stop key={k} offset={k / (colors.length - 1)} stopColor={c} />
							))}
						</linearGradient>
					)}
				</defs>
				<path d={d} fill="none" stroke={rim} strokeWidth="16" opacity="0.12" />
				<path d={d} fill="none" stroke={rim} strokeWidth="8" opacity="0.22" />
				<g clipPath={`url(#c${id})`}>
					<rect x="0" y="0" width="100" height="70" fill="#0b0f1c" />
					{picture && <image href={picture} x="-10" y="-10" width="120" height="90" preserveAspectRatio="xMidYMid slice" opacity="0.8" />}
					{colors.map((c, k) => (
						<rect key={k} x={k * band} y="0" width={band} height="70" fill={c} opacity="0.32" />
					))}
					<rect x="0" y="0" width="100" height="70" fill="url(#lpc-r5map-vignette)" />
				</g>
				<path d={d} fill="none" stroke={rim} strokeWidth="2.2" />
				{ring !== undefined && (
					<path d={d} fill="none" stroke="#fbbf24" strokeWidth="3.2" className="lpc-r5map-a" style={play(["lpc-r5map-fade-in", ring, 350])} />
				)}
			</svg>
			{(name || sub) && (
				<div className={`lpc-r6map-island-text ${merged ? "lpc-r7map-merged-text" : "lpc-r7map-isl-text"}`} style={{ padding: `0 ${pad}%`, "--t": `${text}cqw` } as CSSProperties}>
					{name && <span className="lpc-r6map-island-name">{name}</span>}
					{sub && <span className="lpc-r6map-island-sub">{sub}</span>}
				</div>
			)}
		</div>
	)
}

function Combine({ data }: ClipProps) {
	const m = (data.extra.r6map ?? null) as R6MapData | null
	const combo = m?.two
	if (!m || !combo) return empty
	const laid = layout(m, combo.of)
	const picks = combo.of.map((ref) => laid.find((l) => l.island.grouping === ref.grouping && l.island.id === ref.id)).filter(Boolean) as Laid[]
	if (picks.length !== combo.of.length) return empty
	const t = timeline(picks.length)
	const isPick = (l: Laid) => picks.includes(l)
	const colors = picks.map((p) => p.island.color)
	const around = (k: number) => ({ x: MID.x + [-9, 9][k], y: MID.y })
	return (
		<div className="lpc-r5map-root lpc-r7map-explorer">
			<Sea />
			<BlobDefs />
			{/* The exit: the camera flies into the merged island and the shared titles; only the sea is left. */}
			<div className="lpc-r5map-abs lpc-r5map-a" style={{ inset: 0, transformOrigin: "50% 45%", ...play(["lpc-r5map-none", 0, 1], ["lpc-r8map-fly-out", EXIT, 800, "cubic-bezier(.6,0,.8,.25)"]) }}>
			{/* Everything but the headlines and the tally: on the phone TV it sits lower, under the two-line headline. */}
			{/* While the shared titles are read, the scene keeps a slow push-in: no frozen hold before the exit. */}
			<div className="lpc-r5map-abs lpc-r5map-a" style={{ inset: 0, transformOrigin: "50% 45%", ...play(["lpc-r9b-drift", t.posters, EXIT - t.posters, "linear"]) }}>
			<div className="lpc-r5map-abs lpc-r7map-shift" style={{ inset: 0 }}>
			{/* The map. */}
			<div className="lpc-r5map-abs lpc-r5map-a" style={{ inset: 0, transformOrigin: "50% 55%", ...play(["lpc-r8map-descend", 0, 1700, "cubic-bezier(.16,1,.3,1)"]) }}>
				{REGIONS.map((r, g) => (
					<div key={r.grouping} className="lpc-r6map-at" style={{ ...pos({ x: r.cx, y: CY - RY - 6.4 }), zIndex: 2 }}>
						<div className="lpc-r6map-region lpc-r7map-region lpc-r5map-a" style={play(["lpc-r5map-rise", 450 + g * 120, 700], ["lpc-r5map-fade-out", t.dim, 500])}>
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
									["lpc-r8map-sweep", 120 + l.rank * 45, 1100, "cubic-bezier(.16,1,.3,1)"],
									isPick(l) ? ["lpc-r5map-fade-out", t.gather, 200] : ["lpc-r5map-dim", t.dim, 600],
									undefined,
									{ "--fx": `${(l.x - 50) * 0.55}cqw`, "--fy": `${(l.y - CY) * 1.6 + 4}cqw` } as CSSProperties,
								)}
							>
								<Island seed={l.island.id} name={l.island.name} colors={[l.island.color]} picture={img(l.island.picture, "w300")} w={l.w} text={1.75} />
							</div>
						</div>
					</div>
				))}
			</div>
			{/* The picks: each lights up as it's clicked, then they gather in the middle and merge. They fade only once the
			    merged island has begun to pop in over them, so the middle is never empty. */}
			{picks.map((p, k) => {
				const to = around(k)
				const glide = { "--tx": `${to.x - p.x}cqw`, "--ty": `${((to.y - p.y) * 16) / 9}cqh`, "--ts": "1.55" } as CSSProperties
				return (
					<div key={p.island.id} className="lpc-r6map-at lpc-r6map-mid" style={{ ...pos(p), zIndex: 5 }}>
						<div>
							<div className="lpc-r5map-a" style={play(["lpc-r5map-fade-in", t.clicks[k] + 40, 120], ["lpc-r6map-to", t.gather, 800, GLIDE], ["lpc-r5map-fade-out", t.merge + 150, 350], glide)}>
								<div className="lpc-r5map-a" style={play(["lpc-r6map-pick", t.clicks[k] + 60, 450, DEAL])}>
									<Island seed={p.island.id} name={p.island.name} colors={[p.island.color]} picture={img(p.island.picture, "w500")} w={p.w} text={1.75} ring={t.clicks[k] + 60} />
								</div>
							</div>
						</div>
					</div>
				)
			})}
			<Clicks points={picks.map((p, k) => ({ x: p.x, y: p.y, at: t.clicks[k] }))} leave={t.clicks[picks.length - 1] + 700} />
			{/* The merged island: larger, its name in a padded box. */}
			<div className="lpc-r6map-at lpc-r6map-mid" style={{ ...pos(MID), zIndex: 6 }}>
				<div>
					<div className="lpc-r5map-a" style={play(["lpc-r5map-pop", t.merge, 850, DEAL])}>
						<Island
							seed={combo.of.map((r) => r.id).join("+")}
							name={picks.map((p) => p.island.name).join(" + ")}
							sub={`${fmt(combo.counts.at(-1) ?? 0)} titles`}
							colors={colors}
							picture={img(combo.titles.find((x) => x.backdrop)?.backdrop, "w780")}
							w={MERGED_W}
							text={3.1}
							pad={20}
							merged
						/>
					</div>
				</div>
			</div>
			<div className="lpc-r5map-row" style={{ top: "65.5cqh" }}>
				{combo.titles.slice(0, 6).map((x, k) => (
					<div key={x.key} className="lpc-r5map-a" style={{ width: "7.2cqw", ...play(["lpc-r5map-deal", t.posters + k * 110, 750, DEAL]) }}>
						<img className="lpc-r5map-poster" src={img(x.poster)} alt="" style={{ width: "100%" }} />
						<div className="lpc-r5map-cap">{x.title}</div>
					</div>
				))}
			</div>
			</div>
			</div>
			<Headline kicker="Explorer" text="A map of how movies *feel.*" delay={50} out={HEAD_OUT} />
			<Tally m={m} combo={combo} at={t.show} out={t.head - 400} />
			<Headline kicker="Explorer" text="Mix two. *See* *what* *they* *share.*" delay={t.head} />
			</div>
		</div>
	)
}

/** After each click: the picked islands as chips, and the titles left, big. */
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

/** Round 8's camera flight, retimed: the pointer goes as soon as the first island lands. */
export const ExplorerFlyR9 = ({ data }: ClipProps) => <Combine data={data} />
