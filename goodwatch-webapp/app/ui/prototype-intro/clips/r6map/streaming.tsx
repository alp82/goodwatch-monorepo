// PROTOTYPE - throwaway. Round 6 streaming clips (chapter 8), from round 5's streaming-passport: the big brands, and
// without a pause the wall keeps growing around them; the count lands on a solid panel, big and readable over the
// colourful wall; then a famous title travels country by country in a carousel whose previous and next rows peek in,
// landing on the visitor's country; then the example alert. Real logos, counts and offers (r5map.server.ts).
import type { CSSProperties } from "react"
import type { R5MapData, Service, Where } from "~/server/prototype-intro/r5map.server"
import type { ClipProps } from "../../clip"
import { COUNTRY, DEAL, GLIDE, Headline, Logo, fmt, img, mapData, play } from "../r5map/kit"

const empty = <div className="lpc-r5map-root" />

/** The famous title, its services where the visitor lives, and the countries it visits before. */
function homeOf(m: R5MapData) {
	const w = m.where.find((x) => x.countries.some((c) => c.country === m.home) && x.countries.length >= 4) ?? m.where[0]
	if (!w) return null
	const here = w.countries.find((c) => c.country === m.home) ?? w.countries[0]
	const others = w.countries.filter((c) => c !== here).slice(0, 4)
	const pick = here.services.find((s) => m.popular.some((p) => p.id === s.id)) ?? here.services[0]
	return { w, here, others, pick }
}

// ---------------------------------------------------------------------------------------------------------------
// The wall

/**
 * The big brands deal in as one row, big; right after the last one the camera starts pulling back and the wall
 * grows around them, ring by ring, faster and faster, and it never stops growing until it leaves.
 */
function GrowingWall({ m, out }: { m: R5MapData; out: number }) {
	const cols = 19
	const rows = 13
	const tile = 5
	const gap = tile * 0.14
	const midRow = Math.floor(rows / 2)
	const brands = m.popular.slice(0, 7)
	const startCol = Math.floor((cols - brands.length) / 2)
	const BRANDS_AT = 250
	const BRAND_GAP = 130
	// The wall grows from the moment the last brand has landed.
	const GROW = BRANDS_AT + brands.length * BRAND_GAP + 250
	const cells: { s: Service; r: number; c: number; brand: boolean }[] = []
	let w = 0
	for (let r = 0; r < rows; r++)
		for (let c = 0; c < cols; c++) {
			const isBrand = r === midRow && c >= startCol && c < startCol + brands.length
			const s = isBrand ? brands[c - startCol] : m.wall[w++ % Math.max(1, m.wall.length)]
			if (s) cells.push({ s, r, c, brand: isBrand })
		}
	const width = cols * tile + (cols - 1) * gap
	const height = rows * tile + (rows - 1) * gap
	const maxD = Math.hypot(cols / 2, rows / 2)
	return (
		<div className="lpc-r6map-at" style={{ left: "50cqw", top: "47cqh" }}>
			<div style={{ transform: "translate(-50%, -50%)" }}>
				<div
					className="lpc-r5map-a"
					style={{
						width: `${width}cqw`,
						height: `${height}cqw`,
						transformOrigin: "50% 50%",
						// Pull back from the brands at once, then keep drifting back until the wall leaves: no hold.
						...play(
							["lpc-r5map-cam-out", GROW - 150, 3400, "cubic-bezier(.4,0,.6,.75)"],
							["lpc-r5map-move", GROW + 3250, out - GROW - 3250 + 700, "linear"],
							["lpc-r5map-zoom-away", out, 700, GLIDE],
							{ "--from": "2.2", "--ts": "0.82" } as CSSProperties,
						),
					}}
				>
					{cells.map(({ s, r, c, brand }) => {
						const d = Math.hypot(c - (cols - 1) / 2, (r - midRow) * 1.25) / maxD
						const delay = brand ? BRANDS_AT + (c - startCol) * BRAND_GAP : GROW + Math.pow(d, 0.7) * 2600
						return (
							<div key={`${r}-${c}`} className="lpc-r5map-abs" style={{ left: `${c * (tile + gap)}cqw`, top: `${r * (tile + gap)}cqw` }}>
								<div className="lpc-r5map-a" style={play([brand ? "lpc-r5map-deal" : "lpc-r5map-pop", delay, brand ? 750 : 420, DEAL])}>
									<Logo s={s} w={tile} />
								</div>
							</div>
						)
					})}
				</div>
			</div>
		</div>
	)
}

/** The count, huge, on a solid panel over the wall. */
function Count({ m, at, out }: { m: R5MapData; at: number; out: number }) {
	return (
		<div className="lpc-r6map-at" style={{ left: "50cqw", top: "45cqh", zIndex: 6 }}>
			<div style={{ transform: "translate(-50%, -50%)" }}>
				<div className="lpc-r5map-a" style={play(["lpc-r5map-pop", at, 750, DEAL], ["lpc-r5map-zoom-away", out, 500, GLIDE])}>
					<div className="lpc-r6map-countbox">
						<div className="lpc-r6map-count">{fmt(m.serviceCount)}</div>
						<div className="lpc-r6map-count-line">
							services in {fmt(m.countryCount)} countries. <em>One place.</em>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The example alert (as round 5's)

function Alert({ w, pick, at }: { w: Where; pick: Service; at: number }) {
	return (
		<>
			<div className="lpc-r6map-at" style={{ left: "50cqw", top: "57cqh", zIndex: 6 }}>
				<div style={{ transform: "translate(-50%, -50%)" }}>
					<div className="lpc-r5map-a" style={play(["lpc-r5map-deal-up", at, 900, DEAL])}>
						<div className="lpc-r5map-note" style={{ position: "relative", width: "66cqw" }}>
							{w.poster && <img src={img(w.poster, "w185")} alt="" className="lpc-r5map-poster" style={{ width: "9cqw", borderRadius: "0.6cqw" }} />}
							<div style={{ flex: 1, minWidth: 0 }}>
								<div className="lpc-r5map-note-app">GoodWatch · now</div>
								<div className="lpc-r5map-note-title">It's on {pick.name} now</div>
								<div className="lpc-r5map-note-line">{w.title} just landed on your service.</div>
							</div>
							<div className="lpc-r5map-a" style={play(["lpc-r5map-pop", at + 600, 600, DEAL])}>
								<Logo s={pick} w={8.5} />
							</div>
						</div>
					</div>
				</div>
			</div>
			<div className="lpc-r5map-abs" style={{ left: 0, right: 0, top: "79cqh", textAlign: "center" }}>
				<span className="lpc-r5map-example lpc-r5map-a" style={play(["lpc-r5map-rise", at + 900, 600])}>
					Example
				</span>
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The country carousels

type Stop = Where["countries"][0]

/** A country: its name and services. `you` marks the visitor's. */
function CountryRow({ c, you, logo }: { c: Stop; you: boolean; logo: number }) {
	return (
		<>
			<span className="lpc-r6map-row-name">
				{COUNTRY[c.country] ?? c.country}
				{you && <span className="lpc-r5map-pin">You</span>}
			</span>
			<span className="lpc-r6map-row-logos">
				{c.services.slice(0, 4).map((s) => (
					<Logo key={s.id} s={s} w={logo} />
				))}
			</span>
		</>
	)
}

/**
 * Steps a track by `step` per stop: one wrapper per step, each moving once, so the moves add up. `steps` are the
 * times each move starts.
 */
function Track({ steps, dx = 0, dy = 0, children }: { steps: number[]; dx?: number; dy?: number; children: React.ReactNode }) {
	return steps.reduceRight<React.ReactNode>(
		(inner, at) => (
			<div className="lpc-r5map-a" style={{ position: "absolute", inset: 0, ...play(["lpc-r6map-step", at, 650, "cubic-bezier(.65,0,.35,1)"], undefined, undefined, { "--tx": `${dx}cqw`, "--ty": `${dy}cqh` } as CSSProperties) }}>
				{inner}
			</div>
		),
		children,
	)
}

/** A row or card that is lit while it's the one in the middle: a lit copy over a dim one. */
function Lit({ from, to, children, style, className }: { from: number; to?: number; children: React.ReactNode; style: CSSProperties; className: string }) {
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

const STEP = 800

/**
 * A. The wall grows without a pause; the count lands on a solid panel; then the title's poster on the left and its
 * countries as rows on the right, moving up one by one, the previous and next rows peeking in, dimmed, until the
 * visitor's country is in the middle, lit. Then the alert.
 */
export function StreamingTravelRows({ data }: ClipProps) {
	const m = mapData(data)
	const h = m && homeOf(m)
	if (!m || !h || !m.popular.length) return empty
	const stops = [...h.others, h.here]
	const FLIP = 6300
	const first = FLIP + 600
	const steps = stops.slice(1).map((_, k) => first + 700 + k * STEP)
	const settled = steps.at(-1)! + 650
	const OUT = settled + 1100
	const ROW = 15 // cqh between rows
	return (
		<div className="lpc-r5map-root">
			<GrowingWall m={m} out={5900} />
			<Headline kicker="Streaming" text="Every *service.*" delay={150} out={1900} />
			<Count m={m} at={3300} out={5900} />
			{/* The title. */}
			<div className="lpc-r5map-abs" style={{ left: "7cqw", top: "33cqh" }}>
				{h.w.poster && (
					<img
						className="lpc-r5map-poster lpc-r5map-a"
						src={img(h.w.poster)}
						alt=""
						style={{ height: "44cqh", ...play(["lpc-r5map-deal", FLIP, 750, DEAL], ["lpc-r5map-zoom-away", OUT, 600, GLIDE]) }}
					/>
				)}
			</div>
			{/* The carousel: a window over a column of rows; the middle row is lit, the ones above and below peek in. */}
			<div
				className="lpc-r6map-carousel lpc-r5map-a"
				style={{
					left: "34cqw",
					right: "5cqw",
					top: "30cqh",
					height: "52cqh",
					maskImage: "linear-gradient(180deg, transparent 0%, #000 30%, #000 70%, transparent 100%)",
					WebkitMaskImage: "linear-gradient(180deg, transparent 0%, #000 30%, #000 70%, transparent 100%)",
					...play(["lpc-r5map-fade-in", FLIP + 200, 500], ["lpc-r5map-zoom-away", OUT, 600, GLIDE]),
				}}
			>
				<Track steps={steps} dy={-ROW}>
					{stops.map((c, k) => {
						const you = k === stops.length - 1
						const style: CSSProperties = { top: `${26 - 6.5 + k * ROW}cqh` }
						return (
							<Lit
								key={c.country}
								from={k ? steps[k - 1] + 120 : first}
								to={you ? undefined : steps[k]}
								className={`lpc-r6map-row ${you ? "lpc-r6map-you" : ""}`}
								style={style}
							>
								<CountryRow c={c} you={you} logo={5} />
							</Lit>
						)
					})}
				</Track>
			</div>
			<Headline
				kicker="Streaming"
				text="Where *you* live."
				delay={FLIP}
				out={OUT - 100}
				sub={<span>{h.w.title}, country by country. You see yours.</span>}
			/>
			<Headline kicker="Streaming" text="Want it? We'll tell you *when* *it's* *on.*" delay={OUT + 500} />
			<Alert w={h.w} pick={h.pick} at={OUT + 1200} />
		</div>
	)
}

/**
 * B. The same wall and count; then the countries as big cards side by side, sliding left one at a time. The card in
 * the middle is lit, the previous and next ones peek in from the edges, dimmed, until the visitor's country is in the
 * middle. The title's poster rides above the cards. Then the alert.
 */
export function StreamingTravelCards({ data }: ClipProps) {
	const m = mapData(data)
	const h = m && homeOf(m)
	if (!m || !h || !m.popular.length) return empty
	const stops = [...h.others, h.here]
	const FLIP = 6300
	const first = FLIP + 700
	const steps = stops.slice(1).map((_, k) => first + 700 + k * STEP)
	const settled = steps.at(-1)! + 650
	const OUT = settled + 1100
	const CARD = 34 // cqw
	const GAP = 4
	return (
		<div className="lpc-r5map-root">
			<GrowingWall m={m} out={5900} />
			<Headline kicker="Streaming" text="Every *service.*" delay={150} out={1900} />
			<Count m={m} at={3300} out={5900} />
			<Headline
				kicker="Streaming"
				text="Where *you* live."
				delay={FLIP}
				out={OUT - 100}
				sub={<span>{h.w.title}, country by country. You see yours.</span>}
			/>
			<div
				className="lpc-r6map-carousel lpc-r5map-a"
				style={{
					left: 0,
					right: 0,
					top: "36cqh",
					height: "44cqh",
					maskImage: "linear-gradient(90deg, transparent 0%, #000 22%, #000 78%, transparent 100%)",
					WebkitMaskImage: "linear-gradient(90deg, transparent 0%, #000 22%, #000 78%, transparent 100%)",
					...play(["lpc-r5map-fade-in", FLIP + 250, 500], ["lpc-r5map-zoom-away", OUT, 600, GLIDE]),
				}}
			>
				<Track steps={steps} dx={-(CARD + GAP)}>
					{stops.map((c, k) => {
						const you = k === stops.length - 1
						const style: CSSProperties = { left: `${50 - CARD / 2 + k * (CARD + GAP)}cqw`, width: `${CARD}cqw` }
						return (
							<Lit
								key={c.country}
								from={k ? steps[k - 1] + 120 : first}
								to={you ? undefined : steps[k]}
								className={`lpc-r6map-card ${you ? "lpc-r6map-you" : ""}`}
								style={style}
							>
								{h.w.poster && <img className="lpc-r5map-poster lpc-r6map-phone-hide" src={img(h.w.poster, "w185")} alt="" style={{ height: "17cqh" }} />}
								<span className="lpc-r6map-row-name">
									{COUNTRY[c.country] ?? c.country}
									{you && <span className="lpc-r5map-pin">You</span>}
								</span>
								<span className="lpc-r6map-row-logos">
									{c.services.slice(0, 3).map((s) => (
										<Logo key={s.id} s={s} w={5.4} />
									))}
								</span>
							</Lit>
						)
					})}
				</Track>
			</div>
			<Headline kicker="Streaming" text="Want it? We'll tell you *when* *it's* *on.*" delay={OUT + 500} />
			<Alert w={h.w} pick={h.pick} at={OUT + 1200} />
		</div>
	)
}
