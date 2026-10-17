// PROTOTYPE - throwaway. Round 5 streaming clips (chapter 8), each in four stages: the big services, then everything
// shrinks and speeds up into a huge wall of services, then where you live, then "we'll tell you when it lands".
// Real logos, real counts, and real offers of a famous title by country (r5map.server.ts). The alert is an example.
import type { CSSProperties } from "react"
import type { R5MapData, Service, Where } from "~/server/prototype-intro/r5map.server"
import type { ClipProps } from "../../clip"
import { COUNTRY, DEAL, GLIDE, Headline, Logo, fmt, img, mapData, play } from "./kit"

const empty = <div className="lpc-r5map-root" />

/** The famous title for "where you live" and its services in the visitor's country, known brands first. */
function homeOf(m: R5MapData) {
	const w = m.where.find((x) => x.countries.some((c) => c.country === m.home)) ?? m.where[0]
	if (!w) return null
	const here = w.countries.find((c) => c.country === m.home) ?? w.countries[0]
	const others = w.countries.filter((c) => c !== here).slice(0, 3)
	const pick = here.services.find((s) => m.popular.some((p) => p.id === s.id)) ?? here.services[0]
	return { w, here, others, pick }
}

// ---------------------------------------------------------------------------------------------------------------
// Pieces

/** The countries panel: the title's poster, and its services in the visitor's country and three others. */
function Countries({ w, here, others, at, out }: { w: Where; here: Where["countries"][0]; others: Where["countries"]; at: number; out?: number }) {
	const leave = out === undefined ? undefined : (["lpc-r5map-zoom-away", out, 600, GLIDE] as [string, number, number, string])
	const rows = [here, ...others]
	return (
		<div className={`lpc-r5map-abs ${out !== undefined ? "lpc-r5map-early" : ""}`} style={{ left: "6cqw", right: "6cqw", top: "35cqh", bottom: "12cqh" }}>
			<div className="lpc-r5map-a" style={{ position: "absolute", inset: 0, display: "flex", gap: "3cqw", alignItems: "center", ...play(["lpc-r5map-fade-in", at, 500], leave) }}>
				{w.poster && (
					<img
						className="lpc-r5map-poster lpc-r5map-a lpc-r5map-phone-hide"
						src={img(w.poster)}
						alt=""
						style={{ height: "46cqh", width: "auto", ...play(["lpc-r5map-deal", at, 750, DEAL]) }}
					/>
				)}
				<div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1cqh" }}>
					{rows.map((c, k) => (
						<div
							key={c.country}
							className={`lpc-r5map-country lpc-r5map-a ${k === 0 ? "lpc-r5map-home" : ""}`}
							style={play(["lpc-r5map-deal", at + 300 + (k === 0 ? 3 : k - 1) * 220, 750, DEAL], k === 0 ? undefined : ["lpc-r5map-dim", at + 2400, 700])}
						>
							<span className="lpc-r5map-country-name">
								{COUNTRY[c.country] ?? c.country}
								{k === 0 && <span className="lpc-r5map-pin">You</span>}
							</span>
							<span style={{ display: "flex", gap: "0.8cqw" }}>
								{c.services.slice(0, 4).map((s) => (
									<Logo key={s.id} s={s} w={5.6} />
								))}
							</span>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

/** The example alert: a clean notification card with the title's poster and the service's logo. */
function Alert({ w, pick, at }: { w: Where; pick: Service; at: number }) {
	return (
		<>
			<div className="lpc-r5map-at" style={{ left: "50cqw", top: "58cqh", zIndex: 6 }}>
				<div>
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

/** A dark wash over everything behind a stage's words. */
const Scrim = ({ at, out, strong = 0.78 }: { at: number; out?: number; strong?: number }) => (
	<div
		className={`lpc-r5map-abs lpc-r5map-a ${out !== undefined ? "lpc-r5map-early" : ""}`}
		style={{ inset: 0, zIndex: 3, background: `radial-gradient(70% 70% at 50% 45%, rgba(5,6,10,${strong}) 0%, rgba(5,6,10,${Math.min(0.95, strong + 0.15)}) 100%)`, ...play(["lpc-r5map-fade-in", at, 700], out !== undefined ? ["lpc-r5map-fade-out", out, 500] : undefined) }}
	/>
)

/** The big number and its line. */
function Count({ m, at, out }: { m: R5MapData; at: number; out: number }) {
	return (
		<div className="lpc-r5map-abs lpc-r5map-early" style={{ left: 0, right: 0, top: "30cqh", zIndex: 4, textAlign: "center" }}>
			<div className="lpc-r5map-a" style={play(["lpc-r5map-pop", at, 800, DEAL], ["lpc-r5map-out", out, 500, GLIDE])}>
				<div className="lpc-r5map-count">{fmt(m.serviceCount)}</div>
				<div className="lpc-r5map-sub" style={{ fontSize: "2.6cqw", fontWeight: 800, color: "#fff" }}>
					services in {fmt(m.countryCount)} countries. One place.
				</div>
			</div>
		</div>
	)
}

/**
 * The wall: a grid of logos around the stage's middle, the big brands in the middle row. It starts zoomed in on that
 * row (only the brands showing, big), then zooms out while every other logo pops in, faster and faster.
 */
function Wall({ m, cols, rows, tile, zoomFrom, at, zoomFor, fill }: { m: R5MapData; cols: number; rows: number; tile: number; zoomFrom: number; at: number; zoomFor: number; fill: number }) {
	const gap = tile * 0.14
	const midRow = Math.floor(rows / 2)
	// An odd count in an odd number of columns: the brands sit exactly in the middle.
	const brands = m.popular.slice(0, Math.min(cols % 2 ? 7 : 6, cols))
	const startCol = Math.floor((cols - brands.length) / 2)
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
		<div className="lpc-r5map-at" style={{ left: "50cqw", top: "47cqh" }}>
			<div>
				<div
					className="lpc-r5map-a"
					style={{ width: `${width}cqw`, height: `${height}cqw`, transformOrigin: "50% 50%", ...play(["lpc-r5map-cam-out", at, zoomFor, "cubic-bezier(.55,0,.6,1)"], ["lpc-r5map-move", at + zoomFor, 4000, "linear"], undefined, { "--from": String(zoomFrom), "--ts": "0.9" } as CSSProperties) }}
				>
					{cells.map(({ s, r, c, brand }) => {
						// Further out pops later, and the rhythm speeds up: delay grows with the square root of distance.
						const d = Math.hypot(c - (cols - 1) / 2, (r - midRow) * 1.2) / maxD
						const delay = brand ? 300 + (c - startCol) * 160 : at + 150 + Math.sqrt(d) * fill
						return (
							<div key={`${r}-${c}`} className="lpc-r5map-abs" style={{ left: `${c * (tile + gap)}cqw`, top: `${r * (tile + gap)}cqw` }}>
								<div className="lpc-r5map-a" style={play([brand ? "lpc-r5map-deal" : "lpc-r5map-pop", delay, brand ? 750 : 450, DEAL])}>
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

// ---------------------------------------------------------------------------------------------------------------
/**
 * A. The main take, in four stages: the big brands, big; then the camera pulls back as hundreds of services pop in
 * faster and faster around them, and the count lands; then where you live, for a famous title; then the example alert.
 */
export function StreamingEverywhere({ data }: ClipProps) {
	const m = mapData(data)
	const h = m && homeOf(m)
	if (!m || !h || !m.popular.length) return empty
	return (
		<div className="lpc-r5map-root">
			<div className="lpc-r5map-abs lpc-r5map-a lpc-r5map-early" style={{ inset: 0, ...play(["lpc-r5map-none", 0, 1], ["lpc-r5map-dim", 8300, 700], ["lpc-r5map-fade-out", 9000, 600]) }}>
				<Wall m={m} cols={17} rows={11} tile={5} zoomFrom={2.4} at={3300} zoomFor={2600} fill={1900} />
			</div>
			<Headline kicker="Streaming" text="Every *service.*" delay={250} out={3100} />
			<Scrim at={5600} out={8400} />
			<Count m={m} at={5800} out={8100} />
			<Headline
				kicker="Streaming"
				text="Where *you* live."
				delay={8700}
				out={11400}
				className="lpc-r5map-early"
				sub={<span>{h.w.title} streams on different services in every country. You see yours.</span>}
			/>
			<Countries w={h.w} here={h.here} others={h.others} at={9000} out={11300} />
			<Headline kicker="Streaming" text="Want it? We'll tell you *when* *it's* *on.*" delay={11800} />
			<Alert w={h.w} pick={h.pick} at={12600} />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
/**
 * B. Conveyor: one row of big logos glides past; more rows join, each smaller and faster, until the screen races with
 * hundreds. Then it freezes, and only the services of the visitor's country stay lit: where you live. Then the alert.
 */
export function StreamingConveyor({ data }: ClipProps) {
	const m = mapData(data)
	const h = m && homeOf(m)
	if (!m || !h || !m.popular.length) return empty
	const home = new Set(m.homeServices)
	const all = [...m.popular, ...m.wall]
	// Row 0 is the big brands; then rows of the long tail, each smaller and faster than the last.
	const rows = [
		{ list: m.popular, tile: 11, speed: 9000, at: 300, top: 40 },
		{ list: all.slice(40, 80), tile: 6.4, speed: 4400, at: 2700, top: 64 },
		{ list: all.slice(8, 40), tile: 6.4, speed: 5200, at: 3300, top: 22 },
		{ list: all.slice(130, 180), tile: 4.4, speed: 2800, at: 3800, top: 78 },
		{ list: all.slice(80, 130), tile: 4.4, speed: 3200, at: 4100, top: 10 },
		{ list: all.slice(240, 300), tile: 3.4, speed: 2000, at: 4500, top: 56 },
		{ list: all.slice(180, 240), tile: 3.4, speed: 2200, at: 4700, top: 32 },
	]
	const lit = all.filter((s) => home.has(s.id)).length
	const FREEZE = 7300
	return (
		<div className="lpc-r5map-root">
			<div className="lpc-r5map-abs lpc-r5map-a lpc-r5map-early" style={{ inset: 0, ...play(["lpc-r5map-none", 0, 1], ["lpc-r5map-fade-out", 11400, 600]) }}>
				{rows.map((r, n) => {
					// Each row glides left and slows to a stop at the freeze; faster rows travel further. The list repeats
					// until it covers the trip and the screen.
					const step = r.tile + 0.9
					const travel = ((FREEZE - r.at) / r.speed) * 34
					const list: Service[] = []
					while (list.length * step < travel + 110) list.push(...r.list)
					return (
						<div key={n} className="lpc-r5map-abs lpc-r5map-a" style={{ left: 0, top: `${r.top}cqh`, ...play([n === 0 ? "lpc-r5map-deal" : "lpc-r5map-fade-in", r.at, 700, DEAL]) }}>
							<div
								className="lpc-r5map-marquee lpc-r5map-a"
								style={play(["lpc-r5map-move", r.at, FREEZE - r.at, "cubic-bezier(.35,0,.45,1)"], undefined, undefined, { "--tx": `-${travel}cqw` } as CSSProperties)}
							>
								{list.map((s, k) => (
									<div
										key={k}
										className="lpc-r5map-a"
										style={play(["lpc-r5map-none", 0, 1], home.has(s.id) ? undefined : ["lpc-r5map-dim", FREEZE + 300, 700])}
									>
										<Logo s={s} w={r.tile} />
									</div>
								))}
							</div>
						</div>
					)
				})}
			</div>
			<Headline kicker="Streaming" text="Every *service.*" delay={250} out={3000} />
			<Scrim at={5000} out={7300} strong={0.6} />
			<Count m={m} at={5100} out={7100} />
			{/* A dark band behind the later headlines, over the frozen rows. */}
			<div
				className="lpc-r5map-abs lpc-r5map-a"
				style={{ left: 0, right: 0, top: 0, height: "44cqh", zIndex: 4, background: "linear-gradient(180deg, rgba(5,6,10,.97) 62%, rgba(5,6,10,0))", ...play(["lpc-r5map-fade-in", FREEZE, 600]) }}
			/>
			<Headline
				kicker="Streaming"
				text="Where *you* live."
				delay={FREEZE + 400}
				out={11200}
				className="lpc-r5map-early"
				sub={
					<span>
						<b>{fmt(lit)}</b> of them stream in {COUNTRY[m.home] ?? m.home}. Those are the ones we show you.
					</span>
				}
			/>
			<Headline kicker="Streaming" text="Want it? We'll tell you *when* *it's* *on.*" delay={11800} />
			<Alert w={h.w} pick={h.pick} at={12600} />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
/**
 * C. Passport: the brands in a big grid, then a wall that fills in a rush. Then a famous title travels: country cards
 * flip past with where it streams there, and the last one lands on the visitor's country, bigger. Then the alert.
 */
export function StreamingPassport({ data }: ClipProps) {
	const m = mapData(data)
	const h = m && homeOf(m)
	if (!m || !h || !m.popular.length) return empty
	const stops = [...h.others, h.here]
	const FLIP = 7600
	return (
		<div className="lpc-r5map-root">
			<div className="lpc-r5map-abs lpc-r5map-a lpc-r5map-early" style={{ inset: 0, ...play(["lpc-r5map-none", 0, 1], ["lpc-r5map-zoom-away", 6800, 800, GLIDE]) }}>
				<Wall m={m} cols={15} rows={10} tile={5.6} zoomFrom={2} at={3200} zoomFor={2400} fill={1600} />
			</div>
			<Headline kicker="Streaming" text="Every *service.*" delay={250} out={3000} />
			<Scrim at={5300} out={7100} strong={0.55} />
			<Count m={m} at={5400} out={7000} />
			{/* The title, then country stamps flipping in one after another; the visitor's lands last and stays. */}
			<div className="lpc-r5map-abs lpc-r5map-early" style={{ left: "8cqw", top: "34cqh" }}>
				{h.w.poster && (
					<img
						className="lpc-r5map-poster lpc-r5map-a"
						src={img(h.w.poster)}
						alt=""
						style={{ height: "44cqh", ...play(["lpc-r5map-deal", FLIP, 750, DEAL], ["lpc-r5map-zoom-away", 11300, 600, GLIDE]) }}
					/>
				)}
			</div>
			{stops.map((c, k) => {
				const last = k === stops.length - 1
				const at = FLIP + 400 + k * 800
				return (
					<div key={c.country} className="lpc-r5map-abs lpc-r5map-early" style={{ left: "36cqw", right: "6cqw", top: "40cqh" }}>
						<div
							className={`lpc-r5map-country lpc-r5map-a ${last ? "lpc-r5map-home" : ""}`}
							style={{ background: last ? undefined : "rgba(255,255,255,0.06)", ...play(["lpc-r5map-deal", at, 650, DEAL], last ? ["lpc-r5map-lift", at + 700, 600, DEAL] : ["lpc-r5map-out", at + 700, 350, GLIDE], ["lpc-r5map-zoom-away", 11300, 600, GLIDE]) }}
						>
							<span className="lpc-r5map-country-name">
								{COUNTRY[c.country] ?? c.country}
								{last && <span className="lpc-r5map-pin">You</span>}
							</span>
							<span style={{ display: "flex", gap: "0.8cqw" }}>
								{c.services.slice(0, 4).map((s) => (
									<Logo key={s.id} s={s} w={5} />
								))}
							</span>
						</div>
					</div>
				)
			})}
			<Headline
				kicker="Streaming"
				text="Where *you* live."
				delay={FLIP + 100}
				out={11200}
				className="lpc-r5map-early"
				sub={<span>{h.w.title}, country by country. You see yours.</span>}
			/>
			<Headline kicker="Streaming" text="Want it? We'll tell you *when* *it's* *on.*" delay={11700} />
			<Alert w={h.w} pick={h.pick} at={12500} />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
/**
 * D. Exploration, "Rain": logos fall like rain, slowly at first and then in a downpour, into one GoodWatch card at the
 * bottom. The card answers the only question that matters for a famous title: where can I watch it, here? Then the
 * alert on the same card.
 */
export function StreamingRain({ data }: ClipProps) {
	const m = mapData(data)
	const h = m && homeOf(m)
	if (!m || !h || !m.popular.length) return empty
	const all = [...m.popular, ...m.wall]
	// 160 drops: the big brands first, big and slow, one by one; then the long tail, quicker and closer together
	// until it pours (start times bunch up toward the end).
	const tail = 150
	const drops = [
		...m.popular.map((s, k) => ({ s, x: 12 + ((k * 23) % 76), tile: 8.5, at: 300 + k * 330, fall: 2400 })),
		...all.slice(m.popular.length, m.popular.length + tail).map((s, j) => {
			const r = ((j * 37) % 100) / 100
			return {
				s,
				x: 3 + ((j * 0.618034 + 0.3) % 1) * 94,
				tile: 3.4 + r * 3,
				at: 3000 + (1 - Math.sqrt(1 - j / tail)) * 3600,
				fall: 2500 - r * 700,
			}
		}),
	]
	const CARD = 7000
	return (
		<div className="lpc-r5map-root">
			<div className="lpc-r5map-abs lpc-r5map-early" style={{ inset: 0 }}>
				{drops.map((d, k) => (
					<div key={k} className="lpc-r5map-abs" style={{ left: `${d.x}cqw`, top: "-12cqh" }}>
						<div
							className="lpc-r5map-a"
							style={play(["lpc-r5map-move", d.at, d.fall, "cubic-bezier(.45,0,.9,.6)"], ["lpc-r5map-fade-out", d.at + d.fall - 300, 300], undefined, {
								opacity: 1,
								"--ty": "86cqh",
								"--tx": `${(50 - d.x) * 0.7}cqw`,
								"--ts": "0.4",
							} as CSSProperties)}
						>
							<Logo s={d.s} w={d.tile} />
						</div>
					</div>
				))}
			</div>
			<Headline kicker="Streaming" text="Every *service.*" delay={250} out={3200} />
			<Headline
				kicker="Streaming"
				text={`${fmt(m.serviceCount)} *services.* One answer.`}
				delay={3500}
				out={CARD + 3600}
				className="lpc-r5map-early"
			/>
			{/* The card the rain pours into: where the famous title streams where you live. */}
			<div className="lpc-r5map-at lpc-r5map-early" style={{ left: "50cqw", top: "62cqh", zIndex: 5 }}>
				<div>
					<div className="lpc-r5map-a" style={play(["lpc-r5map-deal-up", CARD - 1400, 800, DEAL], ["lpc-r5map-out", CARD + 3600, 500, GLIDE])}>
						<div className="lpc-r5map-note" style={{ position: "relative", width: "62cqw" }}>
							{h.w.poster && <img src={img(h.w.poster, "w185")} alt="" className="lpc-r5map-poster" style={{ width: "7.5cqw" }} />}
							<div style={{ flex: 1 }}>
								<div className="lpc-r5map-note-app">{COUNTRY[h.here.country] ?? h.here.country} · where you live</div>
								<div className="lpc-r5map-note-title">{h.w.title}</div>
								<div style={{ display: "flex", gap: "0.8cqw", marginTop: "1cqh" }}>
									{h.here.services.slice(0, 4).map((s, k) => (
										<div key={s.id} className="lpc-r5map-a" style={play(["lpc-r5map-pop", CARD - 600 + k * 150, 600, DEAL])}>
											<Logo s={s} w={5} />
										</div>
									))}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
			<Headline kicker="Streaming" text="Want it? We'll tell you *when* *it's* *on.*" delay={CARD + 3900} />
			<Alert w={h.w} pick={h.pick} at={CARD + 4700} />
		</div>
	)
}
