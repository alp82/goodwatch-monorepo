// PROTOTYPE - throwaway. Round 10 streaming clip (chapter 3 in the new order), from round 9's streaming-netflix-r9.
// The owner on round 9: "streaming - make the transitions from and to country screen faster". So the two hand-overs
// around the country screen overlap and are quick:
// - Into it: as the wall and the count leave (now 450 ms and 350 ms), the poster deals in 80 ms later, the headline
//   starts 120 ms later and the first row is lit 300 ms after the wall starts leaving (round 9: a full second).
// - Out of it: the poster and the rows leave in 380 ms (was 600), "Want it? ..." rises as they go (was 200 ms after),
//   and the alert lands 200 ms after that (was 550 ms), in 650 ms (was 900).
// Headlines here use a quicker copy of the kit's Headline (shorter rise, tighter word stagger, faster exit).
// Everything else is round 9's clip: wall, count, rows, Netflix, alert, pushes.
import type { CSSProperties, ReactNode } from "react"
import type { R5MapData, Service, Where } from "~/server/prototype-intro/r5map.server"
import type { R8MapData } from "~/server/prototype-intro/r8map.server"
import type { ClipProps } from "../../clip"
import { Fragment } from "react"
import { COUNTRY, DEAL, GLIDE, Headline, Logo, fmt, img, mapData, play } from "../r5map/kit"
import { Push } from "../r9c/kit"

type Anim = Parameters<typeof play>[0]

const empty = <div className="lpc-r5map-root" />

/**
 * The famous title on Netflix where the visitor lives, its services there (Netflix first), and the countries it visits
 * before. Falls back to round 7's choice when no famous title is on Netflix there.
 */
function homeOf(m: R5MapData, n: R8MapData | null) {
	const w = n?.netflix[0]
	if (w && n?.service) {
		const here = w.countries.find((c) => c.country === n.home) ?? w.countries.at(-1)!
		const services = [n.service, ...here.services.filter((s) => s.id !== n.service!.id)].slice(0, 4)
		return { w, here: { ...here, services }, others: w.countries.filter((c) => c.country !== here.country).slice(0, 4), pick: n.service }
	}
	const w7 = m.where.find((x) => x.countries.some((c) => c.country === m.home) && x.countries.length >= 4) ?? m.where[0]
	if (!w7) return null
	const here = w7.countries.find((c) => c.country === m.home) ?? w7.countries[0]
	const others = w7.countries.filter((c) => c !== here).slice(0, 4)
	const pick = here.services.find((s) => m.popular.some((p) => p.id === s.id)) ?? here.services[0]
	return { w: w7, here, others, pick }
}

// ---------------------------------------------------------------------------------------------------------------
// The wall

/** When things happen in the wall's first six seconds. */
const BRANDS_AT = 250
const BRAND_GAP = 140
const RINGS = 7

/**
 * The big brands deal in as one row; as the last one lands the camera starts its one long pull-back and the wall
 * grows around them ring by ring until the whole wall is there. It dims for the count, then leaves at `out`.
 */
function Wall({ m, dimAt, out }: { m: R5MapData; dimAt: number; out: number }) {
	const cols = 19
	const rows = 13
	const tile = 5
	const gap = tile * 0.14
	const midRow = Math.floor(rows / 2)
	const brands = m.popular.slice(0, 7)
	const startCol = Math.floor((cols - brands.length) / 2)
	const grow = BRANDS_AT + (brands.length - 1) * BRAND_GAP + 550
	const camera = out - grow + 300
	const rings: { s: Service; r: number; c: number }[][] = Array.from({ length: RINGS }, () => [])
	const brandCells: { s: Service; c: number }[] = []
	const maxD = Math.hypot((cols - 1) / 2, ((rows - 1) / 2) * 1.25)
	let w = 0
	for (let r = 0; r < rows; r++)
		for (let c = 0; c < cols; c++) {
			if (r === midRow && c >= startCol && c < startCol + brands.length) {
				brandCells.push({ s: brands[c - startCol], c })
				continue
			}
			const s = m.wall[w++ % Math.max(1, m.wall.length)]
			if (!s) continue
			const d = Math.hypot(c - (cols - 1) / 2, (r - midRow) * 1.25) / maxD
			rings[Math.min(RINGS - 1, Math.floor(d * RINGS))].push({ s, r, c })
		}
	const width = cols * tile + (cols - 1) * gap
	const height = rows * tile + (rows - 1) * gap
	const at = (c: number, r: number) => ({ left: `${c * (tile + gap)}cqw`, top: `${r * (tile + gap)}cqw` })
	// The rings arrive on a gentle ease-in: slow near the brands, quicker as the wall widens, each overlapping the next.
	const ringAt = (k: number) => grow + 2500 * Math.pow(k / (RINGS - 1), 0.8)
	return (
		<div className="lpc-r6map-at" style={{ left: "50cqw", top: "47cqh" }}>
			<div style={{ transform: "translate(-50%, -50%)" }}>
				{/* Leaving, and dimming for the count. */}
				<div className="lpc-r5map-a" style={play(["lpc-r7map-dim", dimAt, 900, "ease-out"], ["lpc-r5map-zoom-away", out, 450, GLIDE])}>
					{/* The camera: one move, the whole way. */}
					<div
						className="lpc-r5map-a lpc-r7map-camera"
						style={{ width: `${width}cqw`, height: `${height}cqw`, ...play(["lpc-r7map-pull", grow - 200, camera, "cubic-bezier(.45,0,.2,1)"]) }}
					>
						{rings.map((cells, k) => (
							<div key={k} className="lpc-r5map-abs lpc-r5map-a lpc-r7map-ring" style={play(["lpc-r7map-ring-in", ringAt(k), 1100, "cubic-bezier(.22,.8,.3,1)"])}>
								{cells.map(({ s, r, c }) => (
									<div key={`${r}-${c}`} className="lpc-r5map-abs" style={at(c, r)}>
										<Logo s={s} w={tile} />
									</div>
								))}
							</div>
						))}
						{brandCells.map(({ s, c }, k) => (
							<div key={c} className="lpc-r5map-abs" style={at(c, midRow)}>
								<div className="lpc-r5map-a" style={play(["lpc-r5map-deal", BRANDS_AT + k * BRAND_GAP, 750, DEAL])}>
									<Logo s={s} w={tile} />
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}

/** The count, huge, over a soft dark vignette: no panel. */
function Count({ m, at, out }: { m: R5MapData; at: number; out: number }) {
	return (
		<>
			<div className="lpc-r7map-vignette lpc-r5map-a" style={play(["lpc-r5map-fade-in", at - 300, 900, "ease-out"], ["lpc-r5map-fade-out", out, 350])} />
			<div className="lpc-r6map-at" style={{ left: "50cqw", top: "44cqh", zIndex: 6 }}>
				<div style={{ transform: "translate(-50%, -50%)" }}>
					<div className="lpc-r5map-a" style={play(["lpc-r7map-count-in", at, 900, DEAL], ["lpc-r5map-zoom-away", out, 350, GLIDE])}>
						<div className="lpc-r7map-countwrap">
							<div className="lpc-r6map-count lpc-r7map-count">{fmt(m.serviceCount)}</div>
							<div className="lpc-r6map-count-line lpc-r7map-count-line">
								services in {fmt(m.countryCount)} countries. <em>One place.</em>
							</div>
						</div>
					</div>
				</div>
			</div>
		</>
	)
}

/** The kit's Headline, quicker: a 550 ms rise, 90 ms between words, and a 350 ms exit, for the snappy hand-overs. */
function QuickHeadline({ kicker, text, delay, out, sub }: { kicker?: string; text: string; delay: number; out?: number; sub?: ReactNode }) {
	const words = text.split(" ")
	const leave: Anim | undefined = out === undefined ? undefined : ["lpc-r5map-out", out, 350, GLIDE]
	return (
		<div className="lpc-r5map-head">
			{kicker && (
				<div className="lpc-r5map-kicker lpc-r5map-a" style={play(["lpc-r5map-rise", delay, 500], leave)}>
					{kicker}
				</div>
			)}
			<h2 className="lpc-r5map-h">
				{words.map((w, i) => (
					<Fragment key={i}>
						<span className="lpc-r5map-word">
							<span className={`lpc-r5map-a ${w.includes("*") ? "lpc-r5map-accent" : ""}`} style={play(["lpc-r5map-word-in", delay + 60 + i * 90, 550], leave)}>
								{w.replace(/\*/g, "")}
							</span>
						</span>{" "}
					</Fragment>
				))}
			</h2>
			{sub && (
				<div className="lpc-r5map-sub lpc-r5map-a" style={play(["lpc-r5map-rise", delay + 120 + words.length * 90, 550], leave)}>
					{sub}
				</div>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The example alert (as round 6's)

function Alert({ w, pick, at }: { w: Where; pick: Service; at: number }) {
	return (
		<>
			<div className="lpc-r6map-at" style={{ left: "50cqw", top: "57cqh", zIndex: 6 }}>
				<div style={{ transform: "translate(-50%, -50%)" }}>
					<div className="lpc-r5map-a" style={play(["lpc-r5map-deal-up", at, ALERT_IN, DEAL])}>
						<div className="lpc-r5map-note" style={{ position: "relative", width: "66cqw" }}>
							{w.poster && <img src={img(w.poster, "w185")} alt="" className="lpc-r5map-poster" style={{ width: "9cqw", borderRadius: "0.6cqw" }} />}
							<div style={{ flex: 1, minWidth: 0 }}>
								<div className="lpc-r5map-note-app">GoodWatch · now</div>
								<div className="lpc-r5map-note-title">It's on {pick.name} now</div>
								<div className="lpc-r5map-note-line">{w.title} just landed on your service.</div>
							</div>
							<div className="lpc-r5map-a" style={play(["lpc-r5map-pop", at + 400, 500, DEAL])}>
								<Logo s={pick} w={8.5} />
							</div>
						</div>
					</div>
				</div>
			</div>
			<div className="lpc-r5map-abs" style={{ left: 0, right: 0, top: "79cqh", textAlign: "center" }}>
				<span className="lpc-r5map-example lpc-r5map-a" style={play(["lpc-r5map-rise", at + 600, 500])}>
					Example
				</span>
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The country rows

type Stop = Where["countries"][0]

function CountryRow({ c, you }: { c: Stop; you: boolean }) {
	return (
		<>
			<span className="lpc-r6map-row-name">
				{COUNTRY[c.country] ?? c.country}
				{you && <span className="lpc-r5map-pin">You</span>}
			</span>
			<span className="lpc-r6map-row-logos">
				{c.services.slice(0, 4).map((s) => (
					<Logo key={s.id} s={s} w={5} />
				))}
			</span>
		</>
	)
}

/** Steps a track by `dy` per stop: one wrapper per step, each moving once, so the moves add up. */
function Track({ steps, dy, children }: { steps: number[]; dy: number; children: ReactNode }) {
	return steps.reduceRight<ReactNode>(
		(inner, at) => (
			<div
				className="lpc-r5map-a"
				style={{ position: "absolute", inset: 0, ...play(["lpc-r6map-step", at, 700, "cubic-bezier(.65,0,.35,1)"], undefined, undefined, { "--ty": `${dy}cqh` } as CSSProperties) }}
			>
				{inner}
			</div>
		),
		children,
	)
}

/** A row lit while it's the one in the middle: a lit copy over a dim one. */
function Lit({ from, to, children, style, className }: { from: number; to?: number; children: ReactNode; style: CSSProperties; className: string }) {
	return (
		<>
			<div className={className} style={{ ...style, opacity: 0.32 }}>
				{children}
			</div>
			<div className={`${className} lpc-r5map-a`} style={{ ...style, ...play(["lpc-r5map-fade-in", from, 350], to === undefined ? undefined : ["lpc-r5map-fade-out", to, 350]) }}>
				{children}
			</div>
		</>
	)
}

const STEP = 820
/** The wall leaves here; the country screen arrives while it goes. */
const WALL_OUT = 6100
const COUNT_AT = 3500
/** Into the country screen: poster, headline and first lit row, counted from WALL_OUT. */
const POSTER_IN = 80
const HEAD_IN = 120
const FIRST_LIT = 300
/** The rows start stepping this long after the first is lit (round 9: 700). */
const FIRST_STEP = 500
/** Out of it: the poster and rows leave in OUT_MS; the alert lands ALERT_AFTER later, in ALERT_IN. */
const OUT_MS = 380
const YOU_HOLD = 900
const ALERT_AFTER = 200
const ALERT_IN = 650
const ALERT_HOLD = 1700

export function StreamingNetflixR10({ data }: ClipProps) {
	const m = mapData(data)
	const h = m && homeOf(m, (data.extra.r8map ?? null) as R8MapData | null)
	if (!m || !h || !m.popular.length) return empty
	const stops = [...h.others, h.here]
	const FLIP = WALL_OUT + HEAD_IN
	const first = WALL_OUT + FIRST_LIT
	const steps = stops.slice(1).map((_, k) => first + FIRST_STEP + k * STEP)
	const settled = steps.at(-1)! + 700
	const OUT = settled + YOU_HOLD
	const ALERT = OUT + ALERT_AFTER
	const END = ALERT + ALERT_IN + ALERT_HOLD
	const ROW = 15
	return (
		<div className="lpc-r5map-root">
			<Wall m={m} dimAt={COUNT_AT - 300} out={WALL_OUT} />
			<Headline kicker="Streaming" text="Every *service.*" delay={150} out={1150} />
			<Count m={m} at={COUNT_AT} out={WALL_OUT} />
			{/* While "You" is read, the poster and the rows push in, slowly, until they leave. */}
			<Push from={settled - 300} dur={YOU_HOLD + 900} scale={1.04} origin="45% 55%">
			<div className="lpc-r5map-abs" style={{ left: "7cqw", top: "33cqh" }}>
				{h.w.poster && (
					<img
						className="lpc-r5map-poster lpc-r5map-a"
						src={img(h.w.poster)}
						alt=""
						style={{ height: "44cqh", ...play(["lpc-r5map-deal", WALL_OUT + POSTER_IN, 550, DEAL], ["lpc-r5map-zoom-away", OUT, OUT_MS, GLIDE]) }}
					/>
				)}
			</div>
			<div
				className="lpc-r6map-carousel lpc-r5map-a"
				style={{
					left: "34cqw",
					right: "5cqw",
					top: "33cqh",
					height: "50cqh",
					maskImage: "linear-gradient(180deg, transparent 0%, #000 30%, #000 70%, transparent 100%)",
					WebkitMaskImage: "linear-gradient(180deg, transparent 0%, #000 30%, #000 70%, transparent 100%)",
					...play(["lpc-r5map-fade-in", WALL_OUT + 150, 350], ["lpc-r5map-zoom-away", OUT, OUT_MS, GLIDE]),
				}}
			>
				<Track steps={steps} dy={-ROW}>
					{stops.map((c, k) => {
						const you = k === stops.length - 1
						return (
							<Lit
								key={c.country}
								from={k ? steps[k - 1] + 120 : first}
								to={you ? undefined : steps[k]}
								className={`lpc-r6map-row ${you ? "lpc-r6map-you" : ""}`}
								style={{ top: `${25 - 6.5 + k * ROW}cqh` }}
							>
								<CountryRow c={c} you={you} />
							</Lit>
						)
					})}
				</Track>
			</div>
			</Push>
			<QuickHeadline kicker="Streaming" text="Where *you* live." delay={FLIP} out={OUT - 80} sub={<span>{h.w.title}, country by country. You see yours.</span>} />
			<QuickHeadline kicker="Streaming" text="Want it? We'll tell you *when* *it's* *on.*" delay={OUT + 60} />
			{/* The alert lands, then keeps a slow push-in until the hand-over. */}
			<Push from={ALERT + ALERT_IN - 150} dur={END - ALERT - ALERT_IN + 150} scale={1.03} origin="50% 58%">
				<Alert w={h.w} pick={h.pick} at={ALERT} />
			</Push>
		</div>
	)
}

/**
 * The clip's length for the usual five country rows: the first row is lit at 6400, the rows step four times from 6900
 * (820 ms apart, 700 ms moves) to settle at 10060; then "You" reads, the rows leave, and the alert lands and holds.
 */
export const STREAMING_NETFLIX_R10_MS = 6100 + FIRST_LIT + FIRST_STEP + 3 * STEP + 700 + YOU_HOLD + ALERT_AFTER + ALERT_IN + ALERT_HOLD
