// "Teletext": a 1980s teletext page. Page header with clock, a mosaic
// banner with the double-height title, the ranking as an index with page numbers, the #1 poster
// in a TV inset, and the four coloured Fastext keys along the bottom.
import { alpha, Brand, col, fit, flex, Img, kind, svgUri } from "../kit"
import { type CardProps, type CardDesign, hash, THEMES } from "../model"

const W = 1080
const H = 1350
const PAD = 44
const INNER = W - PAD * 2
const FASTEXT = ["#ff2a2a", "#2aff4a", "#ffe22a", "#2ae8ff"]

// Teletext "sixel" mosaic: 2x3 cells per character block, drawn as one SVG so it stays one image.
const mosaic = (w: number, h: number, cell: number, colors: string[], seed: number, density: (x: number, y: number, cols: number, rows: number) => number) => {
	const cols = Math.floor(w / cell)
	const rows = Math.floor(h / cell)
	let rects = ""
	let s = seed || 1
	const rnd = () => {
		s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)
		return ((s >>> 0) % 1000) / 1000
	}
	for (let y = 0; y < rows; y++)
		for (let x = 0; x < cols; x++) if (rnd() < density(x, y, cols, rows)) rects += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="${colors[(x + y) % colors.length]}"/>`
	return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${rects}</svg>`)
}

const SCANLINES = svgUri(
	`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${Array.from({ length: Math.floor(H / 4) }, (_, i) => `<rect x="0" y="${i * 4}" width="${W}" height="1.6" fill="black" fill-opacity="0.32"/>`).join("")}</svg>`,
)

function TeletextCard({ title, items, name, theme, date, editing }: CardProps) {
	const t = THEMES[theme]
	const max = 5
	const count = editing ? Math.max(5, Math.min(max, items.length + 1)) : Math.max(1, Math.min(items.length, max))
	const lines = Math.max(count, 5)
	const seed = hash(items.map((i) => i.key).join() + title)
	const heading = (title || "My top 5").toUpperCase()
	const rowH = Math.min(128, Math.floor(690 / lines))
	const dense = rowH < 100
	const thumbH = rowH - 16
	const clock = `${String(18 + (seed % 5)).padStart(2, "0")}:${String((seed >>> 5) % 60).padStart(2, "0")}/${String((seed >>> 11) % 60).padStart(2, "0")}`
	const d = new Date(date)
	const day = Number.isNaN(d.getTime())
		? date
		: `${d.toLocaleDateString("en-US", { weekday: "short" })} ${String(d.getDate()).padStart(2, "0")} ${d.toLocaleDateString("en-US", { month: "short" })}`
		const bannerMosaic = mosaic(INNER, 44, 22, [t.accent, t.accent2, "#ffffff"], seed, (x, _y, cols) => 0.25 + 0.6 * Math.abs(Math.sin((x / cols) * Math.PI * 3)))
	const bannerMosaic2 = mosaic(INNER, 44, 22, [t.accent2, t.accent, "#ffffff"], seed + 7, (x, _y, cols) => 0.25 + 0.6 * Math.abs(Math.cos((x / cols) * Math.PI * 3)))
	return (
		<div style={col({ position: "relative", width: W, height: H, backgroundColor: "#000000", fontFamily: "VT323", color: "#ffffff", overflow: "hidden", padding: `${PAD}px ${PAD}px 0` })}>
			{/* Header row: page, service, page, date, clock */}
			<div style={flex({ height: 56, alignItems: "center", justifyContent: "space-between", fontSize: 44, letterSpacing: 1 })}>
				<div style={flex({ alignItems: "center", gap: 26 })}>
					<div style={{ display: "flex" }}>P888</div>
					<Brand color="#ffffff" size={34} />
					<div style={{ display: "flex", color: t.accent2 }}>888</div>
				</div>
				<div style={flex({ gap: 22 })}>
					<div style={{ display: "flex", color: "#ffffff" }}>{day}</div>
					<div style={{ display: "flex", color: t.accent }}>{clock}</div>
				</div>
			</div>

			{/* Banner: mosaic strips around a full-width double-height headline */}
			<div style={flex({ marginTop: 16, gap: 24, height: 330 })}>
				<div style={col({ flex: 1, height: 330 })}>
					<img src={bannerMosaic} width={INNER} height={44} style={{ display: "flex", width: INNER, height: 44, objectFit: "cover", objectPosition: "left" }} />
					<div style={col({ flex: 1, backgroundColor: t.accent, padding: "14px 26px", justifyContent: "center", gap: 6 })}>
						<div
							data-edit="title"
							style={{ display: "flex", fontSize: fit(heading, [[12, 124], [20, 100], [30, 80], [44, 64], [999, 52]]), lineHeight: 0.86, color: t.ink, letterSpacing: 1 }}
						>
							{heading}
						</div>
					</div>
					<img src={bannerMosaic2} width={INNER} height={44} style={{ display: "flex", width: INNER, height: 44, objectFit: "cover", objectPosition: "right" }} />
				</div>
			</div>

			{/* Sub header */}
			<div style={flex({ marginTop: 22, height: 50, alignItems: "center", justifyContent: "space-between", fontSize: 40, letterSpacing: 1 })}>
				<div style={{ display: "flex", color: t.accent2 }}>{`TOP ${count} · INDEX`}</div>
				<div style={{ display: "flex", color: "#ffffff" }}>{`COMPILED BY ${(name || "A VIEWER").toUpperCase()}`}</div>
			</div>
			<div style={{ display: "flex", height: 6, backgroundColor: t.accent2, marginBottom: 10 }} />

			{/* Index rows */}
			<div style={col({ height: rowH * lines })}>
				{Array.from({ length: lines }, (_, i) => {
					const item = items[i]
					const page = 301 + i
					if (i >= count)
						return (
							<div key={`blank-${i}`} style={flex({ height: rowH, alignItems: "center", fontSize: dense ? 42 : 50, color: alpha("#ffffff", 0.25) })}>
								<div style={{ display: "flex", width: 84 }}>{String(i + 1).padStart(2, " ")}</div>
								<div style={{ display: "flex", flex: 1, overflow: "hidden", whiteSpace: "nowrap" }}>{"· ".repeat(60)}</div>
								<div style={{ display: "flex", width: 90, justifyContent: "flex-end" }}>{page}</div>
							</div>
						)
					return (
						<div key={item?.key ?? `empty-${i}`} data-slot={i} style={flex({ height: rowH, alignItems: "center", gap: 18 })}>
							<div style={flex({ width: 72, height: thumbH, alignItems: "center", justifyContent: "center", backgroundColor: i === 0 ? t.accent : t.accent2, color: t.ink, fontSize: dense ? 60 : 76, flexShrink: 0 })}>{i + 1}</div>
							{item ? (
								<div style={flex({ padding: 3, backgroundColor: "#ffffff", flexShrink: 0 })}>
									<Img src={item.poster} w={Math.round((thumbH - 6) / 1.5)} h={thumbH - 6} />
								</div>
							) : (
								<div style={{ display: "flex", width: Math.round(thumbH / 1.5), height: thumbH, border: `3px dashed ${alpha("#ffffff", 0.5)}`, flexShrink: 0 }} />
							)}
							<div style={col({ flex: 1, minWidth: 0, justifyContent: "center" })}>
								<div style={{ display: "flex", fontSize: item ? fit(item.title, dense ? [[24, 44], [999, 36]] : [[22, 56], [34, 46], [999, 38]]) : 44, lineHeight: 0.95, color: item ? "#ffffff" : alpha("#ffffff", 0.4), overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
									{item ? item.title.toUpperCase() : "ADD A TITLE"}
								</div>
								{item && !dense && (
									<div style={{ display: "flex", fontSize: 32, color: t.accent2 }}>
										{[item.year, kind(item).toUpperCase(), item.score != null ? `GW ${item.score}` : null].filter(Boolean).join("  ")}
									</div>
								)}
							</div>
							<div style={flex({ width: 110, justifyContent: "flex-end", fontSize: dense ? 42 : 50, color: t.accent })}>{page}</div>
						</div>
					)
				})}
			</div>

			<div style={{ display: "flex", flexGrow: 1 }} />
			{/* Fastext keys */}
			<div style={flex({ height: 64, marginBottom: 34, alignItems: "center", justifyContent: "space-between", fontSize: 40 })}>
				{["Rate", "Lists", "Top 100", "goodwatch.app"].map((label, i) => (
					<div key={label} style={{ display: "flex", color: FASTEXT[i] }}>
						{label}
					</div>
				))}
			</div>

			<img src={SCANLINES} width={W} height={H} style={{ position: "absolute", top: 0, left: 0, width: W, height: H, pointerEvents: "none" }} />
			<div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: W, height: H, pointerEvents: "none", backgroundImage: `radial-gradient(ellipse at 50% 45%, ${alpha(t.accent, 0.07)} 0%, ${alpha("#000000", 0)} 70%)` }} />
		</div>
	)
}

export const teletext: CardDesign = { key: "teletext", name: "Teletext", format: "Post 4:5", w: W, h: H, Card: TeletextCard }
