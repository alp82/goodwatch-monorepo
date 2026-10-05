// PROTOTYPE - throwaway. Three shareable list cards. Each renders twice: as DOM for the live
// preview and through satori for the PNG. Satori rules: inline styles only, every element with
// more than one child needs display: flex, no z-index (later siblings paint on top).
import type { ReactNode } from "react"
import { alpha, Brand, col, fit, flex, Img, kind, pad, Placeholder, svgUri } from "./kit"
import { type CardProps, type Design, hash, type ListItem, THEMES } from "./model"

// ------------------------------------------------------------------ A: Podium
// 9:16 story. The #1 pick's backdrop bleeds in from the top, a condensed poster-type title,
// the winner gets a hero row with a giant numeral, the rest line up underneath.
export function PodiumCard({ title, items, name, theme, editing }: CardProps) {
	const t = THEMES[theme]
	const [first, ...rest] = items
	const slots = editing ? 4 : rest.length
	const headline = (title || "My top 5").toUpperCase()
	return (
		<div style={col({ position: "relative", width: 1080, height: 1920, backgroundColor: t.ink, color: "#fff", fontFamily: "Gabarito", overflow: "hidden" })}>
			{first?.backdrop && <Img src={first.backdrop} w={1080} h={1180} style={{ position: "absolute", top: 0, left: 0 }} />}
			<div
				style={{
					display: "flex",
					position: "absolute",
					top: 0,
					left: 0,
					width: 1080,
					height: 1920,
					backgroundImage: `linear-gradient(180deg, ${alpha(t.ink, 0.25)} 0%, ${alpha(t.ink, 0.55)} 30%, ${t.ink} 58%, ${t.ink} 100%)`,
				}}
			/>
			<div
				style={{
					display: "flex",
					position: "absolute",
					top: -300,
					right: -300,
					width: 900,
					height: 900,
					backgroundImage: `radial-gradient(circle, ${alpha(t.accent, 0.35)} 0%, ${alpha(t.accent, 0)} 65%)`,
				}}
			/>
			<div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: 1080, height: 14, backgroundImage: `linear-gradient(90deg, ${t.accent}, ${t.accent2})` }} />

			<div style={col({ position: "relative", width: 1080, height: 1920, padding: "84px 72px 72px" })}>
				<div style={flex({ justifyContent: "space-between", alignItems: "center" })}>
					<Brand color="#fff" size={52} />
					<div style={flex({ backgroundColor: t.accent, color: t.ink, fontWeight: 900, fontSize: 30, padding: "10px 26px", borderRadius: 999, letterSpacing: 2 })}>
						TOP {Math.max(items.length, editing ? 5 : 1)}
					</div>
				</div>

				<div style={flex({ flexGrow: 1 })} />

				<div data-edit="title" style={{ display: "flex", fontFamily: "Anton", fontSize: fit(headline, [[12, 168], [22, 136], [34, 112], [50, 92], [999, 76]]), lineHeight: 0.95, maxWidth: 936, textShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>
					{headline}
				</div>
				<div style={{ display: "flex", width: 180, height: 12, marginTop: 36, marginBottom: 56, borderRadius: 6, backgroundImage: `linear-gradient(90deg, ${t.accent}, ${t.accent2})` }} />

				<div style={flex({ alignItems: "flex-end", height: 480 })}>
					<div style={{ display: "flex", fontFamily: "Anton", fontSize: 460, lineHeight: 0.78, color: t.accent, marginRight: 8, marginBottom: -6 }}>1</div>
					{first ? (
						<Img slot={0} src={first.poster} w={320} h={480} style={{ borderRadius: 18, boxShadow: `0 30px 80px ${alpha("#000000", 0.7)}` }} />
					) : (
						<Placeholder w={320} h={480} n={1} color="#ffffff" style={{ borderRadius: 18 }} />
					)}
					{first && (
						<div style={col({ flex: 1, marginLeft: 40, marginBottom: 8, gap: 14 })}>
							<div style={{ display: "flex", fontWeight: 900, fontSize: fit(first.title, [[14, 64], [24, 52], [40, 42], [999, 34]]), lineHeight: 1.02 }}>{first.title}</div>
							<div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: alpha("#ffffff", 0.6) }}>
								{[first.year, kind(first)].filter(Boolean).join("  ·  ")}
							</div>
						</div>
					)}
				</div>

				<div style={flex({ gap: 24, marginTop: 72 })}>
					{Array.from({ length: slots }, (_, i) => {
						const item = rest[i]
						return (
							<div key={item?.key ?? i} style={col({ position: "relative", width: 216, gap: 16 })}>
								{item ? (
									<Img slot={i + 1} src={item.poster} w={216} h={324} style={{ borderRadius: 14, boxShadow: `0 20px 50px ${alpha("#000000", 0.6)}` }} />
								) : (
									<Placeholder w={216} h={324} n={i + 2} color="#ffffff" style={{ borderRadius: 14 }} />
								)}
								{item && (
									<div style={{ display: "flex", fontSize: fit(item.title, [[16, 26], [28, 22], [999, 19]]), fontWeight: 700, lineHeight: 1.15, height: 60, overflow: "hidden" }}>
										{item.title}
									</div>
								)}
								<div
									style={{
										display: "flex",
										position: "absolute",
										top: -54,
										left: -16,
										fontFamily: "Anton",
										fontSize: 96,
										lineHeight: 1,
										color: t.accent,
										textShadow: `0 6px 30px ${alpha("#000000", 0.8)}`,
									}}
								>
									{i + 2}
								</div>
							</div>
						)
					})}
				</div>

				<div style={flex({ justifyContent: "space-between", alignItems: "center", marginTop: 88, paddingTop: 36, borderTop: `2px solid ${alpha("#ffffff", 0.14)}` })}>
					<div style={col({ gap: 4 })}>
						<div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: alpha("#ffffff", 0.5), letterSpacing: 3 }}>CURATED BY</div>
						<div data-edit="name" style={{ display: "flex", fontSize: 38, fontWeight: 900, color: t.accent2 }}>{name || "someone with taste"}</div>
					</div>
					<div style={col({ alignItems: "flex-end", gap: 4 })}>
						<div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: alpha("#ffffff", 0.5), letterSpacing: 3 }}>MAKE YOURS</div>
						<div style={{ display: "flex", fontSize: 38, fontWeight: 900 }}>goodwatch.app</div>
					</div>
				</div>
			</div>
		</div>
	)
}

// ------------------------------------------------------------------ B: Receipt
// 9:16 story. A thermal-paper receipt for your taste, tilted on a loud color field.
// Pure typography, no posters: it reads instantly and looks nothing like a streaming UI.
const RECEIPT_W = 820
const zigzag = (color: string, flip: boolean) => {
	const tooth = 20
	const h = 22
	let d = flip ? "M0 0" : `M0 ${h}`
	for (let x = 0; x < RECEIPT_W; x += tooth) d += flip ? ` L${x + tooth / 2} ${h} L${x + tooth} 0` : ` L${x + tooth / 2} 0 L${x + tooth} ${h}`
	d += " Z"
	return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${RECEIPT_W}" height="${h}" viewBox="0 0 ${RECEIPT_W} ${h}"><path d="${d}" fill="${color}"/></svg>`)
}
// Drawn dashes: resvg panics on a zero-height box with a dashed border.
const Rule = () => (
	<div style={flex({ justifyContent: "space-between", margin: "26px 0" })}>
		{Array.from({ length: 35 }, (_, i) => (
			<div key={i} style={{ display: "flex", width: 12, height: 3, backgroundColor: "#2b2b2b" }} />
		))}
	</div>
)
const Line = ({ l, r, size = 26, bold = false }: { l: ReactNode; r: ReactNode; size?: number; bold?: boolean }) => (
	<div style={flex({ justifyContent: "space-between", fontSize: size, fontWeight: bold ? 700 : 400, lineHeight: 1.45 })}>
		<div style={{ display: "flex" }}>{l}</div>
		<div style={{ display: "flex" }}>{r}</div>
	</div>
)

export function ReceiptCard({ title, items, name, theme, date, editing }: CardProps) {
	const t = THEMES[theme]
	const paper = "#fbf9f2"
	const ink = "#1c1c1c"
	const seed = hash(items.map((i) => i.key).join(",") + title)
	const scores = items.map((i) => i.score).filter((s): s is number => s != null)
	const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
	const dense = items.length > 5
	const bars = Array.from({ length: 58 }, (_, i) => 2 + ((((seed >>> (i % 29)) ^ (i * 7919)) >>> 0) % 7))
	const shown = editing && items.length < 5 ? [...items, ...Array(5 - items.length).fill(null)] : items
	return (
		<div
			style={col({
				position: "relative",
				width: 1080,
				height: 1920,
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: t.accent,
				backgroundImage: `radial-gradient(circle at 20% 10%, ${alpha(t.accent2, 0.9)} 0%, ${alpha(t.accent2, 0)} 55%)`,
				fontFamily: "Space Mono",
				color: ink,
				overflow: "hidden",
			})}
		>
			<div style={col({ width: RECEIPT_W, transform: "rotate(-2.5deg)" })}>
				<img src={zigzag(paper, false)} width={RECEIPT_W} height={22} style={{ display: "flex", width: RECEIPT_W, height: 22 }} />
				<div style={col({ position: "relative", backgroundColor: paper, padding: "40px 64px 48px", boxShadow: `0 40px 60px ${alpha(t.ink, 0.35)}` })}>
					<div style={col({ alignItems: "center", gap: 6 })}>
						<Brand color={ink} size={58} />
						<div style={{ display: "flex", fontSize: 26, letterSpacing: 8, marginTop: 14 }}>*** TASTE RECEIPT ***</div>
					</div>
					<Rule />
					<Line l="DATE" r={date.toUpperCase()} />
					<Line l="ORDER" r={`#${String(seed % 1000000).padStart(6, "0")}`} />
					<div data-edit="name" style={col({})}>
						<Line l="CURATOR" r={(name || "ANONYMOUS").toUpperCase()} />
					</div>
					<Rule />
					<div data-edit="title" style={{ display: "flex", fontSize: fit(title, [[18, 50], [30, 42], [999, 34]]), fontWeight: 700, lineHeight: 1.15, textTransform: "uppercase" }}>
						{title || "My top 5"}
					</div>
					<Rule />
					<div style={col({ gap: dense ? 10 : 22 })}>
						{shown.map((item: ListItem | null, i) => (
							<div key={item?.key ?? `empty-${i}`} data-slot={i} style={col({})}>
								<div style={flex({ fontSize: dense ? 26 : 32, fontWeight: 700, lineHeight: 1.2 })}>
									<div style={{ display: "flex", width: dense ? 58 : 70, flexShrink: 0 }}>{pad(i + 1)}</div>
									<div style={{ display: "flex", flex: 1, textTransform: "uppercase", color: item ? ink : alpha(ink, 0.3) }}>
										{item?.title ?? "_ _ _ _ _ _ _ _"}
									</div>
									<div style={{ display: "flex", marginLeft: 20 }}>{item?.score != null ? item.score : ""}</div>
								</div>
								{item && (
									<div style={{ display: "flex", marginLeft: dense ? 58 : 70, fontSize: dense ? 20 : 22, color: alpha(ink, 0.6), textTransform: "uppercase" }}>
										{[item.year, item.genre ?? kind(item)].filter(Boolean).join(" · ")}
									</div>
								)}
							</div>
						))}
					</div>
					<Rule />
					<Line l="ITEMS" r={items.length} />
					{avg != null && <Line l="AVG GOODWATCH SCORE" r={avg} />}
					<Line l="TOTAL" r="NO REGRETS" size={34} bold />
					<Rule />
					<div style={flex({ justifyContent: "center", alignItems: "flex-end", height: 96, gap: 3, marginTop: 6 })}>
						{bars.map((w, i) => (
							<div key={i} style={{ display: "flex", width: w, height: i % 11 === 0 ? 96 : 84, backgroundColor: i % 3 === 2 ? paper : ink }} />
						))}
					</div>
					<div style={col({ alignItems: "center", marginTop: 22, fontSize: 24, letterSpacing: 4 })}>
						<div style={{ display: "flex" }}>THANK YOU FOR WATCHING</div>
						<div style={{ display: "flex", fontWeight: 700 }}>MAKE YOURS AT GOODWATCH.APP</div>
					</div>

					<div
						style={col({
							position: "absolute",
							right: -40,
							top: 18,
							width: 210,
							height: 210,
							borderRadius: 999,
							border: `7px solid ${alpha("#d62828", 0.8)}`,
							alignItems: "center",
							justifyContent: "center",
							transform: "rotate(-16deg)",
							color: alpha("#d62828", 0.85),
							fontWeight: 700,
							fontSize: 26,
							letterSpacing: 2,
							lineHeight: 1.1,
						})}
					>
						<div style={{ display: "flex" }}>CERTIFIED</div>
						<div style={{ display: "flex", fontSize: 50, fontFamily: "Anton", letterSpacing: 1 }}>GOOD</div>
						<div style={{ display: "flex" }}>TASTE</div>
					</div>
				</div>
				<img src={zigzag(paper, true)} width={RECEIPT_W} height={22} style={{ display: "flex", width: RECEIPT_W, height: 22 }} />
			</div>
		</div>
	)
}

// ------------------------------------------------------------------ C: Cover
// 4:5 feed post. A magazine cover: the masthead sits on a solid field of the theme color and
// the posters straddle its edge, #1 as the cover photo with the rest in a grid beside it.
export const COVER_W = 1080
export const COVER_H = 1350
const COVER_PAPER = "#f3efe6"
const COVER_INK = "#15120e"
const COVER_TOP = 392 // posters start here
const COVER_H_ART = 720 // poster block height
const COVER_FIELD = 700 // color field ends here, halfway down the posters
const COVER_GAP = 20

// Ink or white, whichever reads on the given color.
const onColor = (hex: string) => {
	const n = Number.parseInt(hex.slice(1, 7), 16)
	return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 128 ? "#ffffff" : COVER_INK
}

type Box = { x: number; y: number; w: number; h: number }
// Poster boxes by rank: #1 is the tall cover photo, the rest fill a 1- or 2-column grid.
const coverBoxes = (n: number): Box[] => {
	const H = COVER_H_ART
	const big = { w: Math.round(H / 1.5), h: H }
	if (n <= 1) return [{ x: (COVER_W - big.w) / 2, y: COVER_TOP, ...big }]
	if (n === 2) {
		const x0 = (COVER_W - big.w * 2 - COVER_GAP) / 2
		return [
			{ x: x0, y: COVER_TOP, ...big },
			{ x: x0 + big.w + COVER_GAP, y: COVER_TOP, ...big },
		]
	}
	const ch = (H - COVER_GAP) / 2
	const cw = Math.round(ch / 1.5)
	const cols = n >= 4 ? 2 : 1
	const total = big.w + COVER_GAP + cols * cw + (cols - 1) * COVER_GAP
	const x0 = (COVER_W - total) / 2
	const gx = x0 + big.w + COVER_GAP
	const cells = Array.from({ length: n - 1 }, (_, i) => ({
		x: gx + (i % cols) * (cw + COVER_GAP),
		y: COVER_TOP + Math.floor(i / cols) * (ch + COVER_GAP),
		w: cw,
		h: ch,
	}))
	return [{ x: x0, y: COVER_TOP, ...big }, ...cells]
}

// Poster, or a typographic stand-in when the title has no artwork.
const CoverArt = ({ item, w, h, color }: { item: ListItem; w: number; h: number; color: string }) =>
	item.poster ? (
		<Img src={item.poster} w={w} h={h} />
	) : (
		<div style={col({ width: w, height: h, backgroundColor: color, padding: w * 0.08, justifyContent: "flex-end" })}>
			<div style={{ display: "flex", fontFamily: "Instrument Serif", fontStyle: "italic", fontSize: w * 0.16, lineHeight: 0.95, color: onColor(color) }}>{item.title}</div>
		</div>
	)

export function CoverCard({ title, items, name, theme, date, editing }: CardProps) {
	const t = THEMES[theme]
	const paper = COVER_PAPER
	const ink = COVER_INK
	const onField = onColor(t.accent)
	const count = editing ? 5 : Math.max(1, Math.min(5, items.length))
	const boxes = coverBoxes(count)
	const issue = (hash(title + items.map((i) => i.key).join()) % 90) + 10
	const words = (title || "My top 5").split(" ")
	const half = Math.ceil(words.length / 2)
	const lead = words.slice(0, half).join(" ")
	const tail = words.slice(half).join(" ")
	const size = fit(title || "My top 5", [[14, 128], [24, 112], [36, 92], [52, 76], [999, 64]])
	// A four-item grid has one empty cell: it becomes a call to action instead of a hole.
	const spare = !editing && count === 4 ? { x: boxes[3].x + boxes[3].w + COVER_GAP, y: boxes[3].y, w: boxes[3].w, h: boxes[3].h } : null
	return (
		<div style={col({ position: "relative", width: COVER_W, height: COVER_H, backgroundColor: paper, color: ink, fontFamily: "Bricolage Grotesque", overflow: "hidden" })}>
			<div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: COVER_W, height: COVER_FIELD, backgroundColor: t.accent }} />
			<div style={{ display: "flex", position: "absolute", top: COVER_FIELD - 220, left: 0, width: COVER_W, height: 220, backgroundImage: `linear-gradient(180deg, ${alpha(t.accent2, 0)} 0%, ${alpha(t.accent2, 0.55)} 100%)` }} />

			<div style={flex({ position: "absolute", top: 52, left: 60, right: 60, justifyContent: "space-between", alignItems: "center" })}>
				<Brand color={onField} size={42} />
				<div style={flex({ gap: 22, fontSize: 21, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", color: onField })}>
					<div style={{ display: "flex" }}>Issue No. {issue}</div>
					<div style={{ display: "flex", opacity: 0.6 }}>{date}</div>
				</div>
			</div>
			<div style={{ display: "flex", position: "absolute", top: 118, left: 60, width: 960, height: 3, backgroundColor: onField }} />

			<div data-edit="title" style={col({ position: "absolute", top: 138, left: 60, width: 780, color: onField, fontFamily: "Instrument Serif", fontSize: size, lineHeight: 0.9, letterSpacing: -2 })}>
				<div style={{ display: "flex" }}>{lead}</div>
				{tail && <div style={{ display: "flex", fontStyle: "italic" }}>{tail}</div>}
			</div>

			<div
				style={col({
					position: "absolute",
					top: 140,
					right: 60,
					width: 170,
					height: 170,
					borderRadius: 999,
					backgroundColor: ink,
					color: t.accent,
					alignItems: "center",
					justifyContent: "center",
					transform: "rotate(-12deg)",
				})}
			>
				<div style={{ display: "flex", fontSize: 20, fontWeight: 800, letterSpacing: 3, color: paper }}>THE</div>
				<div style={{ display: "flex", fontFamily: "Instrument Serif", fontStyle: "italic", fontSize: 58, lineHeight: 0.95 }}>{`Top ${editing ? 5 : Math.max(1, items.length)}`}</div>
				<div style={{ display: "flex", fontSize: 16, fontWeight: 800, letterSpacing: 3, color: paper }}>RANKED</div>
			</div>

			{boxes.map((b, i) => {
				const item = items[i]
				return (
					<div key={item?.key ?? `slot-${i}`} data-slot={i} style={col({ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h })}>
						{item ? (
							<div style={flex({ width: b.w, height: b.h, boxShadow: `0 26px 50px ${alpha("#1a1208", 0.4)}` })}>
								<CoverArt item={item} w={b.w} h={b.h} color={t.accent2} />
							</div>
						) : (
							<Placeholder w={b.w} h={b.h} n={i + 1} color={ink} style={{ backgroundColor: alpha(paper, 0.55) }} />
						)}
						<div
							style={flex({
								position: "absolute",
								top: 0,
								left: 0,
								alignItems: "center",
								gap: 4,
								padding: i === 0 ? "10px 18px" : "6px 12px",
								backgroundColor: i === 0 ? paper : ink,
								color: i === 0 ? ink : paper,
								fontWeight: 800,
							})}
						>
							<div style={{ display: "flex", fontSize: i === 0 ? 22 : 16, letterSpacing: 2, opacity: 0.6 }}>NO.</div>
							<div style={{ display: "flex", fontSize: i === 0 ? 44 : 30, lineHeight: 1 }}>{i + 1}</div>
						</div>
					</div>
				)
			})}

			{spare && (
				<div style={col({ position: "absolute", left: spare.x, top: spare.y, width: spare.w, height: spare.h, backgroundColor: ink, padding: 22, justifyContent: "space-between" })}>
					<div style={{ display: "flex", fontFamily: "Instrument Serif", fontStyle: "italic", fontSize: 54, lineHeight: 0.92, color: t.accent }}>Your turn.</div>
					<div style={{ display: "flex", fontSize: 18, fontWeight: 800, letterSpacing: 2, color: paper }}>GOODWATCH.APP</div>
				</div>
			)}

			<div style={col({ position: "absolute", left: 60, right: 60, top: COVER_TOP + COVER_H_ART + 34, bottom: 48, justifyContent: "space-between" })}>
				<div style={flex({ flexWrap: "wrap", columnGap: 28, rowGap: 10, fontSize: items.length > 3 ? 23 : 27, fontWeight: 800, lineHeight: 1.15 })}>
					{items.slice(0, 5).map((item, i) => (
						<div key={item.key} style={flex({ gap: 10, alignItems: "center" })}>
							<div style={flex({ width: 30, height: 30, alignItems: "center", justifyContent: "center", backgroundColor: i === 0 ? t.accent : ink, color: i === 0 ? onField : paper, fontSize: 18 })}>{i + 1}</div>
							<div style={{ display: "flex" }}>{item.title}</div>
						</div>
					))}
				</div>
				<div style={flex({ justifyContent: "space-between", alignItems: "center", fontSize: 21, color: alpha(ink, 0.65) })}>
					<div data-edit="name" style={{ display: "flex" }}>{`Curated by ${name || "someone with taste"}`}</div>
					<div style={{ display: "flex", fontWeight: 800, color: ink, letterSpacing: 1 }}>goodwatch.app</div>
				</div>
			</div>
		</div>
	)
}

export const podium: Design = { key: "podium", name: "Podium", format: "Story 9:16", w: 1080, h: 1920, max: 5, Card: PodiumCard }
export const receipt: Design = { key: "receipt", name: "Receipt", format: "Story 9:16", w: 1080, h: 1920, max: 5, Card: ReceiptCard }
export const cover: Design = { key: "cover", name: "Cover", format: "Post 4:5", w: COVER_W, h: COVER_H, max: 5, Card: CoverCard }
