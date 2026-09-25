// "Cover": a 4:5 magazine cover on a field of the theme color, posters first.
import { alpha, Brand, col, fit, flex, Img, Placeholder } from "../kit"
import { type CardDesign, type CardProps, type CardTitle, hash, THEMES } from "../model"

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
const CoverArt = ({ item, w, h, color }: { item: CardTitle; w: number; h: number; color: string }) =>
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
					<div style={{ display: "flex" }}>{`Curated by ${name || "someone with taste"}`}</div>
					<div style={{ display: "flex", fontWeight: 800, color: ink, letterSpacing: 1 }}>goodwatch.app</div>
				</div>
			</div>
		</div>
	)
}

export const cover: CardDesign = { key: "cover", name: "Cover", format: "Post 4:5", w: COVER_W, h: COVER_H, Card: CoverCard }
