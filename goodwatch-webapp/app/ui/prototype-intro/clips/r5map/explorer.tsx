// PROTOTYPE - throwaway. Round 5 Explorer clips (chapter 7): the mood map with a combination demo. Real islands,
// colours, counts and the famous titles two islands share (r5map.server.ts). Islands are drawn as the real Explorer
// draws them: organic blobs with a glowing rim, filled with their best title's picture, on a night sea.
import type { CSSProperties } from "react"
import type { MapIsland, MapPair } from "~/server/prototype-intro/r5map.server"
import type { ClipProps } from "../../clip"
import { Blob, BlobDefs, DEAL, GLIDE, Headline, SETTLE, Sea, fmt, img, islandPicture, mapData, play, spread } from "./kit"

const empty = <div className="lpc-r5map-root"><Sea /></div>
/** An island's width in cqw, by how many titles it holds. */
const sizeOf = (i: MapIsland, max: number, base = 8.5, grow = 6.5) => base + Math.sqrt(i.count / max) * grow
/** cqw on both axes (as the 16:9 stage measures) to a position: x in cqw, y in cqh. */
const pos = (p: { x: number; y: number }) => ({ left: `${p.x}cqw`, top: `${(p.y * 16) / 9}cqh` })

function useMap(data: ClipProps["data"], box = { cx: 50, cy: 31, rx: 34, ry: 12.5 }, base = 10.5, grow = 7) {
	const m = mapData(data)
	if (!m?.islands.length || !m.pairs.length) return null
	const pair = m.pairs[0]
	const a = m.islands.find((i) => i.id === pair.a)
	const b = m.islands.find((i) => i.id === pair.b)
	if (!a || !b) return null
	const max = Math.max(...m.islands.map((i) => i.count))
	const sizes = m.islands.map((i) => sizeOf(i, max, base, grow))
	const spots = spread(
		m.islands.map((i, n) => ({ x: i.x, y: i.y, w: sizes[n] })),
		box,
	)
	// Pop in from the middle out.
	const order = m.islands.map((_, n) => n).sort((p, q) => Math.hypot(spots[p].x - box.cx, spots[p].y - box.cy) - Math.hypot(spots[q].x - box.cx, spots[q].y - box.cy))
	return { m, pair, a, b, sizes, spots, order, ia: m.islands.indexOf(a), ib: m.islands.indexOf(b) }
}

const andWord = (pair: MapPair, a: MapIsland, b: MapIsland) =>
	`${fmt(pair.count)} titles are ${a.name.toLowerCase()} and ${b.name.toLowerCase()}.`

function Posters({ pair, top, at, w = 9.2, n = 6 }: { pair: MapPair; top: string; at: number; w?: number; n?: number }) {
	return (
		<div className="lpc-r5map-row" style={{ top }}>
			{pair.titles.slice(0, n).map((t, k) => (
				<div key={t.key} className="lpc-r5map-a" style={{ width: `${w}cqw`, ...play(["lpc-r5map-deal", at + k * 160, 750, DEAL]) }}>
					<img className="lpc-r5map-poster" src={img(t.poster)} alt="" style={{ width: "100%" }} />
					<div className="lpc-r5map-cap">{t.title}</div>
				</div>
			))}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
/**
 * A. The main take: the map falls into view and names itself; then two islands light up, lift off the map and glide
 * into the dashed "Combine" circle in the middle, where they merge into one island with both colours, and the famous
 * titles they share deal in under it.
 */
export function ExplorerCombine({ data }: ClipProps) {
	const s = useMap(data)
	if (!s) return empty
	const { m, pair, a, b, sizes, spots, order, ia, ib } = s
	const MID = { x: 50, y: 24 } // in cqw, as the map
	// The two islands glide from their spots to either side of the middle, then into it.
	const glide = (n: number, side: number): CSSProperties =>
		({
			"--tx": `${MID.x + side * 9 - spots[n].x}cqw`,
			"--ty": `${((MID.y - spots[n].y) * 16) / 9}cqh`,
			"--ts": "1.1",
			"--tx2": `${MID.x - spots[n].x}cqw`,
			"--ty2": `${((MID.y - spots[n].y) * 16) / 9}cqh`,
			"--ts2": "0.6",
		}) as CSSProperties
	return (
		<div className="lpc-r5map-root">
			<Sea />
			<BlobDefs />
			{/* The map: it falls into view, then everything but the two steps back. */}
			<div className="lpc-r5map-abs lpc-r5map-a" style={{ inset: 0, transformOrigin: "50% 50%", ...play(["lpc-r5map-cam-in", 0, 2600, SETTLE]) }}>
				{m.islands.map((i, n) => {
					const picked = n === ia || n === ib
					const rank = order.indexOf(n)
					return (
						<div key={i.id} className="lpc-r5map-at" style={pos(spots[n])}>
							<div>
								<div
									className="lpc-r5map-a"
									style={play(["lpc-r5map-pop", 250 + rank * 90, 750, DEAL], picked ? ["lpc-r5map-fade-out", 4300, 300] : ["lpc-r5map-dim", 3800, 900])}
								>
									<Blob seed={i.id} name={i.name} colors={[i.color]} picture={islandPicture(i)} w={sizes[n]} />
								</div>
							</div>
						</div>
					)
				})}
			</div>
			{/* The dashed circle where islands combine (as on the Explorer). */}
			<div className="lpc-r5map-at" style={pos(MID)}>
				<div>
					<div className="lpc-r5map-a" style={play(["lpc-r5map-pop", 3900, 700, DEAL], ["lpc-r5map-fade-out", 6000, 400])}>
						<div className="lpc-r5map-combine" style={{ position: "relative", width: "17cqw", height: "17cqw" }}>
							Combine
						</div>
					</div>
				</div>
			</div>
			{/* The two picked islands, on top: they light up, glide to the circle and into it. */}
			{[ia, ib].map((n, side) => {
				const i = m.islands[n]
				return (
					<div key={i.id} className="lpc-r5map-at" style={{ ...pos(spots[n]), zIndex: 4 }}>
						<div>
							<div
								className="lpc-r5map-a"
								style={play(
									["lpc-r5map-fade-in", 3700, 400],
									["lpc-r5map-move", 4300, 1500, GLIDE],
									["lpc-r5map-move2", 6000, 700, "cubic-bezier(.55,0,.75,.2)"],
									glide(n, side ? 1 : -1),
								)}
							>
								<div className="lpc-r5map-a" style={play(["lpc-r5map-none", 0, 1], ["lpc-r5map-fade-out", 6250, 450])}>
									<Blob seed={i.id} name={i.name} colors={[i.color]} picture={islandPicture(i)} w={sizes[n] * 1.25} />
								</div>
							</div>
						</div>
					</div>
				)
			})}
			{/* The merged island. */}
			<div className="lpc-r5map-at" style={{ ...pos(MID), zIndex: 5 }}>
				<div>
					<div className="lpc-r5map-a" style={play(["lpc-r5map-pop", 6400, 900, DEAL])}>
						<Blob
							seed={`${a.id}+${b.id}`}
							name={`${a.name} + ${b.name}`}
							sub={`${fmt(pair.count)} titles`}
							colors={[a.color, b.color]}
							picture={img(pair.titles.find((t) => t.backdrop)?.backdrop, "w780")}
							w={24}
						/>
					</div>
				</div>
			</div>
			<Headline kicker="Explorer" text="A map of how movies *feel.*" delay={350} out={3300} />
			<Headline kicker="Explorer" text="Mix two. *See* *what* *they* *share.*" delay={6700} />
			<Posters pair={pair} top="64cqh" at={7400} w={8.2} />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
/**
 * B. Pull back: the camera starts close on one island filled with its titles and pulls back to the whole map. A second
 * island lights up, a dotted bridge forms between the two, and the famous titles they share rise from the bridge.
 */
export function ExplorerPullBack({ data }: ClipProps) {
	const s = useMap(data, { cx: 50, cy: 30, rx: 34, ry: 12 })
	if (!s) return empty
	const { m, pair, a, b, sizes, spots, ia, ib } = s
	const pa = spots[ia]
	const pb = spots[ib]
	const dots = 9
	return (
		<div className="lpc-r5map-root">
			<Sea />
			<BlobDefs />
			{/* Once the bridge stands, the map rises and shrinks to make room for the titles. */}
			<div
				className="lpc-r5map-abs lpc-r5map-a"
				style={{ inset: 0, transformOrigin: "50% 30%", ...play(["lpc-r5map-move", 5600, 1100, GLIDE], undefined, undefined, { "--ty": "-4cqh", "--ts": "0.78" } as CSSProperties) }}
			>
			<div
				className="lpc-r5map-abs lpc-r5map-a"
				style={{ inset: 0, transformOrigin: `${pa.x}cqw ${(pa.y * 16) / 9}cqh`, ...play(["lpc-r5map-cam-out", 0, 3600, "cubic-bezier(.7,0,.2,1)"], undefined, undefined, { "--from": "3.6" } as CSSProperties) }}
			>
				{m.islands.map((i, n) => {
					const picked = n === ia || n === ib
					return (
						<div key={i.id} className="lpc-r5map-at" style={pos(spots[n])}>
							<div>
								<div className="lpc-r5map-a" style={play(["lpc-r5map-fade-in", n === ia ? 0 : 1200, 900], picked ? ["lpc-r5map-lift", 4400, 700, DEAL] : ["lpc-r5map-dim", 4200, 900])}>
									<Blob seed={i.id} name={i.name} colors={[i.color]} picture={islandPicture(i)} w={sizes[n]} />
								</div>
							</div>
						</div>
					)
				})}
				{/* The bridge: dots from one island's edge to the other's. */}
				{Array.from({ length: dots }, (_, k) => {
					const t = (k + 1) / (dots + 1)
					return (
						<div
							key={k}
							className="lpc-r5map-dot lpc-r5map-a"
							style={{ left: `${pa.x + (pb.x - pa.x) * t}cqw`, top: `${((pa.y + (pb.y - pa.y) * t) * 16) / 9}cqh`, zIndex: 3, ...play(["lpc-r5map-pop", 4900 + k * 80, 400, DEAL]) }}
						/>
					)
				})}
			</div>
			</div>
			<Headline kicker="Explorer" text="Every feeling has an *island.*" delay={900} out={4500} />
			<Headline
				kicker="Explorer"
				text={`${a.name} *+* ${b.name}.`}
				delay={5600}
				sub={<span><b>{fmt(pair.count)} titles</b> live where the two meet.</span>}
			/>
			<Posters pair={pair} top="64cqh" at={6800} w={8.2} />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
/**
 * C. Poster islands: each island shows as a small fan of its most famous posters, the way the Explorer's islands fill
 * with titles. Two fans slide together and their posters shuffle into the titles they share.
 */
export function ExplorerFans({ data }: ClipProps) {
	const m = mapData(data)
	const pair = m?.pairs[0]
	const a = m?.islands.find((i) => i.id === pair?.a)
	const b = m?.islands.find((i) => i.id === pair?.b)
	if (!m || !pair || !a || !b) return empty
	const others = m.islands.filter((i) => i !== a && i !== b).slice(0, 4)
	const spots = [
		{ i: others[0], x: 13, y: 40 },
		{ i: others[1], x: 87, y: 40 },
		{ i: others[2], x: 13, y: 72 },
		{ i: others[3], x: 87, y: 72 },
	].filter((s) => s.i)
	const Fan = ({ i, w = 6 }: { i: MapIsland; w?: number }) => (
		<div style={{ position: "relative", width: `${w * 2.2}cqw`, height: `${w * 1.6}cqw` }}>
			{i.titles.slice(0, 3).map((t, k) => (
				<img
					key={t.key}
					src={img(t.poster, "w185")}
					alt=""
					className="lpc-r5map-poster"
					style={{ position: "absolute", left: `${(k - 1) * w * 0.55 + w * 0.6}cqw`, top: 0, width: `${w}cqw`, transform: `rotate(${(k - 1) * 9}deg)`, transformOrigin: "50% 120%", zIndex: k === 1 ? 2 : 1 }}
				/>
			))}
			<div style={{ position: "absolute", left: 0, right: 0, top: `${w * 1.62}cqw`, textAlign: "center", fontWeight: 800, fontSize: `${w * 0.36}cqw` }}>
				<span style={{ display: "inline-block", width: "0.7em", height: "0.7em", borderRadius: "50%", background: i.color, marginRight: "0.35em" }} />
				{i.name}
			</div>
		</div>
	)
	return (
		<div className="lpc-r5map-root">
			<Sea />
			{spots.map((s, n) => (
				<div key={s.i.id} className="lpc-r5map-at lpc-r5map-phone-hide" style={{ left: `${s.x}cqw`, top: `${s.y}cqh` }}>
					<div>
						<div className="lpc-r5map-a" style={play(["lpc-r5map-deal", 600 + n * 140, 750, DEAL], ["lpc-r5map-dim", 3600, 900])}>
							<Fan i={s.i} w={5} />
						</div>
					</div>
				</div>
			))}
			{[a, b].map((i, side) => (
				<div key={i.id} className="lpc-r5map-at" style={{ left: side ? "64cqw" : "36cqw", top: "52cqh", zIndex: 3 }}>
					<div>
						<div
							className="lpc-r5map-a"
							style={play(
								["lpc-r5map-deal", 300 + side * 160, 800, DEAL],
								["lpc-r5map-move", 4000, 1300, GLIDE],
								["lpc-r5map-fade-out", 5200, 400],
								{ "--tx": `${side ? -10 : 10}cqw`, "--ts": "0.9" } as CSSProperties,
							)}
						>
							<Fan i={i} w={8} />
						</div>
					</div>
				</div>
			))}
			{/* The shared titles: dealt out from where the two fans met. */}
			<div className="lpc-r5map-row" style={{ top: "40cqh" }}>
				{pair.titles.slice(0, 6).map((t, k) => (
					<div key={t.key} className="lpc-r5map-a" style={{ width: "10cqw", ...play(["lpc-r5map-deal", 5400 + k * 150, 750, DEAL]) }}>
						<img className="lpc-r5map-poster" src={img(t.poster)} alt="" style={{ width: "100%" }} />
						<div className="lpc-r5map-cap">{t.title}</div>
					</div>
				))}
			</div>
			<Headline kicker="Explorer" text="Pick two moods." delay={250} out={4800} />
			<Headline
				kicker="Explorer"
				text={`${a.name} *+* ${b.name}`}
				delay={5000}
				sub={<span><b>{fmt(pair.count)}</b> titles have both.</span>}
			/>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
/**
 * D. Exploration, "Your mix": two islands at either side, a slider between them. As the knob travels from one to the
 * other, the row of titles changes from the first island's best, to what they share, to the second's best.
 */
export function ExplorerMix({ data }: ClipProps) {
	const m = mapData(data)
	const pair = m?.pairs[0]
	const a = m?.islands.find((i) => i.id === pair?.a)
	const b = m?.islands.find((i) => i.id === pair?.b)
	if (!m || !pair || !a || !b) return empty
	const shared = new Set(pair.titles.map((t) => t.key))
	const onlyA = a.titles.filter((t) => !shared.has(t.key)).slice(0, 4)
	const onlyB = b.titles.filter((t) => !shared.has(t.key)).slice(0, 4)
	const rows = [
		{ titles: onlyA.length >= 3 ? onlyA : a.titles.slice(0, 4), label: `All ${a.name.toLowerCase()}`, at: 2400, out: 4300 },
		{ titles: pair.titles.slice(0, 4), label: `${a.name} + ${b.name}`, at: 4700, out: 7300 },
		{ titles: onlyB.length >= 3 ? onlyB : b.titles.slice(0, 4), label: `All ${b.name.toLowerCase()}`, at: 7700, out: undefined },
	]
	// The knob travels across the track in three stops: left, middle, right.
	const knob = { "--tx": "18cqw", "--tx2": "36cqw" } as CSSProperties
	return (
		<div className="lpc-r5map-root">
			<Sea />
			<BlobDefs />
			{[a, b].map((i, side) => (
				<div key={i.id} className="lpc-r5map-at" style={{ left: side ? "84cqw" : "16cqw", top: "40cqh" }}>
					<div>
						<div className="lpc-r5map-a" style={play(["lpc-r5map-pop", 300 + side * 180, 800, DEAL])}>
							<Blob seed={i.id} name={i.name} colors={[i.color]} picture={islandPicture(i)} w={17} />
						</div>
					</div>
				</div>
			))}
			{/* The track and its knob. */}
			<div className="lpc-r5map-abs lpc-r5map-a" style={{ left: "32cqw", width: "36cqw", top: "40cqh", height: "0.6cqw", marginTop: "-0.3cqw", borderRadius: 9, background: `linear-gradient(90deg, ${a.color}, ${b.color})`, opacity: 0.9, ...play(["lpc-r5map-fade-in", 900, 700]) }} />
			<div className="lpc-r5map-abs" style={{ left: "32cqw", top: "40cqh" }}>
				<div
					className="lpc-r5map-a"
					style={{
						width: "3.2cqw",
						height: "3.2cqw",
						margin: "-1.6cqw 0 0 -1.6cqw",
						borderRadius: "50%",
						background: "#fff",
						boxShadow: "0 0 0 0.4cqw #fbbf24, 0 0.6cqw 2cqw rgba(0,0,0,.6)",
						...play(["lpc-r5map-pop", 1300, 600, DEAL], ["lpc-r5map-move", 4300, 1300, GLIDE], ["lpc-r5map-move2", 7300, 1300, GLIDE], knob),
					}}
				/>
			</div>
			{rows.map((r) => (
				<div key={r.label} className={`lpc-r5map-abs ${r.out ? "lpc-r5map-early" : ""}`} style={{ left: 0, right: 0, top: "52cqh" }}>
					<div className="lpc-r5map-a" style={{ textAlign: "center", fontWeight: 800, fontSize: "2cqw", color: "#fbbf24", ...play(["lpc-r5map-rise", r.at, 600], r.out ? ["lpc-r5map-fade-out", r.out, 400] : undefined) }}>
						{r.label}
					</div>
					<div className="lpc-r5map-row" style={{ top: "5.5cqh" }}>
						{r.titles.map((t, k) => (
							<div key={t.key} className="lpc-r5map-a" style={{ width: "8.4cqw", ...play(["lpc-r5map-deal", r.at + 100 + k * 120, 700, DEAL], r.out ? ["lpc-r5map-fade-out", r.out + k * 40, 350] : undefined) }}>
								<img className="lpc-r5map-poster" src={img(t.poster)} alt="" style={{ width: "100%" }} />
								<div className="lpc-r5map-cap">{t.title}</div>
							</div>
						))}
					</div>
				</div>
			))}
			<Headline kicker="Explorer" text="Find *your* *mix.*" delay={250} sub={<span>Slide between two moods. The overlap is where the gems are.</span>} />
		</div>
	)
}
