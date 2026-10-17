// PROTOTYPE - throwaway. The Explorer clips: the mood map, two islands combined, a fly-over, and one title on the map.
// Real islands, colours, counts and titles from the Explorer as a guest sees it (explorertrack.server.ts).
import type { CSSProperties } from "react"
import type { EtIsland } from "~/server/prototype-intro/explorertrack.server"
import type { ClipProps } from "../../clip"
import { DEAL, Headline, Island, Poster, SETTLE, at, at2, etData, spread } from "./kit"

const fmt = (n: number) => n.toLocaleString("en-US")
/** An island's width in cqw, by how many titles it holds. */
const sizeOf = (i: EtIsland, max: number) => 8.5 + Math.sqrt(i.count / max) * 7.5
const empty = <div className="lpc-et-sea" />

// ---------------------------------------------------------------------------------------------------------------
/** A. The map: the camera falls back to show every mood island, then drifts to one and names what sets it apart. */
export function ExplorerMap({ data }: ClipProps) {
	const et = etData(data)
	if (!et?.islands.length) return empty
	const max = Math.max(...et.islands.map((i) => i.count))
	const focus = et.islands.find((i) => i.id === "cozy") ?? et.islands[0]
	// Nearest the middle first.
	const order = [...et.islands].sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))
	// In cqw on both axes (the stage is 16:9, so 31cqw is about 55% of its height).
	const spots = spread(
		et.islands.map((i) => ({ x: i.x, y: i.y, w: sizeOf(i, max) })),
		{ cx: 60, cy: 32, rx: 24, ry: 14 },
	)
	return (
		<>
			<div className="lpc-et-sea" />
			<div
				className="lpc-et-cam lpc-et-a2"
				style={{
					transformOrigin: `${spots[et.islands.indexOf(focus)].x}cqw ${spots[et.islands.indexOf(focus)].y}cqw`,
					...at2(["lpc-et-cam-in", 100, 2400, SETTLE], ["lpc-et-cam-drift", 2500, 4500, "ease-in-out"]),
				}}
			>
				{et.islands.map((i, n) => {
					const rank = order.indexOf(i)
					const isFocus = i.id === focus.id
					return (
						<div key={i.id} className="lpc-et-at" style={{ left: `${spots[n].x}cqw`, top: `${spots[n].y}cqw` }}>
							<div
								className={isFocus ? "lpc-et-a" : "lpc-et-a2"}
								style={
									isFocus
										? at("lpc-et-pop", 500 + rank * 110, 700, DEAL)
										: at2(["lpc-et-pop", 500 + rank * 110, 700, DEAL], ["lpc-et-dim", 3600, 900])
								}
							>
								<Island name={i.name} color={i.color} w={sizeOf(i, max)}>
									{isFocus && <span className="lpc-et-ring lpc-et-a" style={at("lpc-et-pop", 3600, 700, DEAL)} />}
								</Island>
							</div>
						</div>
					)
				})}
			</div>
			<div className="lpc-et-scrim" />
			<Headline kicker="Explorer" text="A map of how *movies* *feel.*" delay={300} />
			<div className="lpc-et-apart">
				<div className="lpc-et-a" style={at("lpc-et-rise", 3900, 800)}>
					<span className="lpc-et-swatch" style={{ "--c": focus.color } as CSSProperties} />
					<span className="lpc-et-apart-name">{focus.name}</span>
				</div>
				<div className="lpc-et-line lpc-et-a" style={at("lpc-et-rise", 4100, 800)}>
					{focus.apart}. <b>{fmt(focus.count)} titles.</b>
				</div>
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------------
/** B. The bridge: two islands glide together, a dotted bridge forms, and the titles they share deal in. */
export function ExplorerBridge({ data }: ClipProps) {
	const et = etData(data)
	const a = et?.islands.find((i) => i.id === et.bridge?.a)
	const b = et?.islands.find((i) => i.id === et.bridge?.b)
	if (!et?.bridge || !a || !b) return empty
	const posters = et.bridge.titles.filter((t) => t.poster).slice(0, 6)
	const dots = 7
	return (
		<>
			<div className="lpc-et-sea" />
			<Headline kicker="Explorer" text="Combine *two* *feelings.*" delay={200} size="lpc-et-h-mid" />
			<div className="lpc-et-at" style={{ left: "24cqw", top: "47cqh" }}>
				<div className="lpc-et-a" style={at("lpc-et-from", 900, 1300, SETTLE, { "--fx": "-34cqw", "--fs": "0.8" } as CSSProperties)}>
					<Island name={a.name} color={a.color} w={22} />
				</div>
			</div>
			<div className="lpc-et-at" style={{ left: "76cqw", top: "47cqh" }}>
				<div className="lpc-et-a" style={at("lpc-et-from", 1050, 1300, SETTLE, { "--fx": "34cqw", "--fs": "0.8" } as CSSProperties)}>
					<Island name={b.name} color={b.color} w={22} />
				</div>
			</div>
			{Array.from({ length: dots }, (_, n) => (
				<div
					key={n}
					className="lpc-et-dot lpc-et-a"
					style={{ left: `${37.5 + (n * 25) / (dots - 1)}cqw`, top: "47cqh", ...at("lpc-et-pop", 2300 + n * 90, 450, DEAL) }}
				/>
			))}
			<div className="lpc-et-row" style={{ top: "33cqh" }}>
				<span className="lpc-et-pill lpc-et-a" style={at("lpc-et-pop", 3000, 700, DEAL)}>
					{a.name} + {b.name}
				</span>
			</div>
			<div className="lpc-et-row" style={{ top: "62cqh" }}>
				{posters.map((t, n) => (
					<div key={t.key} className="lpc-et-a" style={at("lpc-et-deal", 3500 + n * 170, 750, DEAL)}>
						<Poster path={t.poster} style={{ width: "9.4cqw" }} />
					</div>
				))}
			</div>
			<div className="lpc-et-row lpc-et-line" style={{ top: "90.5cqh" }}>
				<span className="lpc-et-a" style={at("lpc-et-rise", 4700, 800)}>
					<b>{fmt(et.bridge.count)} titles</b> are both {a.name.toLowerCase()} and {b.name.toLowerCase()}.
				</span>
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------------
/** C. The fly-over: the camera glides along the islands, each with its best titles standing on it. */
export function ExplorerFlyover({ data }: ClipProps) {
	const et = etData(data)
	if (!et?.islands.length) return empty
	const max = Math.max(...et.islands.map((i) => i.count))
	// The pass ends on the warm islands.
	const ORDER = ["dark", "sad", "tense", "thrilling", "romantic", "magical", "funny", "cozy"]
	const row = ORDER.flatMap((id) => et.islands.find((i) => i.id === id && i.titles.length >= 3) ?? [])
	return (
		<>
			<div className="lpc-et-sea" />
			<div className="lpc-et-stars lpc-et-a" style={at("lpc-et-fly-far", 0, 7000, "linear")} />
			<div className="lpc-et-strip lpc-et-a" style={at("lpc-et-fly", 0, 7000, "cubic-bezier(.45,0,.4,1)")}>
				{row.map((i, n) => (
					<div key={i.id} className="lpc-et-at" style={{ left: `${36 + n * 25}cqw`, top: `${n % 2 ? 80 : 75}cqh` }}>
						<div className="lpc-et-a" style={at("lpc-et-pop", 200 + n * 380, 800, DEAL)}>
							<Island name={i.name} color={i.color} w={sizeOf(i, max) + 3} />
							<div className="lpc-et-fan">
								{i.titles.slice(0, 3).map((t) => (
									<Poster key={t.key} path={t.poster} />
								))}
							</div>
						</div>
					</div>
				))}
			</div>
			<div className="lpc-et-scrim" />
			<Headline kicker="Explorer" text="Every island, its own kind of *evening.*" delay={300} size="lpc-et-h-mid" />
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------------
/** D. One title on the map: it lands in the middle, the islands it belongs to light up, the rest fall back. */
export function ExplorerPlaced({ data }: ClipProps) {
	const et = etData(data)
	if (!et?.placed || !et.islands.length) return empty
	const { title, on } = et.placed
	const max = Math.max(...et.islands.map((i) => i.count))
	const mine = et.islands.filter((i) => on.includes(i.id))
	const others = et.islands.filter((i) => !on.includes(i.id)).slice(0, 6 - Math.min(3, mine.length))
	const ring = [...mine.slice(0, 3), ...others]
	// Around the poster, in percent of the stage.
	const spots = ring.map((_, n) => {
		const a = (n / ring.length) * Math.PI * 2 - Math.PI / 2 + 0.35
		return { x: 50 + Math.cos(a) * 31, y: 59 + Math.sin(a) * 27 }
	})
	const names = mine.map((i) => i.name.toLowerCase())
	const said = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0]
	return (
		<>
			<div className="lpc-et-sea" />
			<svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
				{ring.map((i, n) =>
					on.includes(i.id) ? (
						<line
							key={i.id}
							x1={50}
							y1={59}
							x2={spots[n].x}
							y2={spots[n].y}
							stroke="#fbbf24"
							strokeWidth={2.5}
							strokeDasharray="1 7"
							strokeLinecap="round"
							vectorEffect="non-scaling-stroke"
							className="lpc-et-a"
							style={at("lpc-et-fade", 2700 + n * 150, 700)}
						/>
					) : null,
				)}
			</svg>
			{ring.map((i, n) => {
				const lit = on.includes(i.id)
				return (
					<div key={i.id} className="lpc-et-at" style={{ left: `${spots[n].x}cqw`, top: `${spots[n].y}cqh` }}>
						<div
							className="lpc-et-a2"
							style={
								lit
									? at2(["lpc-et-pop", 1300 + n * 120, 700, DEAL], ["lpc-et-lift", 2700, 700, DEAL])
									: at2(["lpc-et-pop", 1300 + n * 120, 700, DEAL], ["lpc-et-dim", 2700, 800])
							}
						>
							<Island name={i.name} color={i.color} w={sizeOf(i, max) * 0.85}>
								{lit && <span className="lpc-et-ring lpc-et-a" style={at("lpc-et-pop", 2800, 600, DEAL)} />}
							</Island>
						</div>
					</div>
				)
			})}
			<div className="lpc-et-at" style={{ left: "50cqw", top: "59cqh" }}>
				<div style={{ transform: "translate(-50%, -50%)", width: "11cqw" }}>
					<div className="lpc-et-a" style={at("lpc-et-deal", 400, 900, DEAL)}>
						<Poster path={title.poster} style={{ width: "11cqw" }} />
					</div>
				</div>
			</div>
			<Headline kicker="Explorer" text="Every title sits where it *feels.*" delay={200} size="lpc-et-h-mid" />
			<div className="lpc-et-row lpc-et-line" style={{ top: "88cqh" }}>
				<span className="lpc-et-a" style={at("lpc-et-rise", 3500, 800)}>
					<b>{title.title}</b> is {said}.
				</span>
			</div>
		</>
	)
}
