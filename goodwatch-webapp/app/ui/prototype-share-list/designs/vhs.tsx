// PROTOTYPE - throwaway. "VHS shelf": a video-store staff-picks shelf. #1–#3 stand face-out in
// clamshell rental cases with price stickers and shelf-edge labels; #4 and #5 lie as cassettes
// with handwritten spine labels on the shelf below, next to a taped-up staff-pick card.
// An aisle sign carries the list title. 4:5 feed post.
import { alpha, Brand, col, fit, flex, Placeholder } from "../kit"
import { type CardProps, type Design, type ListItem, THEMES } from "../model"

const W = 1080
const H = 1350
const BOX_W = 306
const BOX_H = 556 // VHS clamshell proportions (about 104 x 188 mm)
const SHELF1 = 900 // top surface of the upper shelf
const SHELF2 = 1198 // top surface of the lower shelf
const SPINE_W = 610
const SPINE_H = 78

type Theme = (typeof THEMES)[keyof typeof THEMES]

// Warm laminate shelf: top face, front edge, and a price channel that holds the labels.
function Shelf({ top }: { top: number }) {
	return (
		<div style={col({ position: "absolute", left: 0, top, width: W })}>
			<div style={{ display: "flex", height: 14, backgroundImage: "linear-gradient(180deg, #8a6a4a 0%, #5d4128 100%)" }} />
			<div style={col({ height: 58, backgroundImage: "linear-gradient(180deg, #3b2716 0%, #24170c 100%)", justifyContent: "center" })}>
				<div style={{ display: "flex", height: 44, marginLeft: 20, marginRight: 20, backgroundColor: alpha("#000000", 0.28), borderTop: `1px solid ${alpha("#ffffff", 0.08)}` }} />
			</div>
			<div style={{ display: "flex", height: 26, backgroundImage: `linear-gradient(180deg, ${alpha("#000000", 0.55)} 0%, ${alpha("#000000", 0)} 100%)` }} />
		</div>
	)
}

// A face-out rental case: black clamshell, poster behind clear plastic, glare, stickers.
function Clamshell({ item, rank, t }: { item: ListItem; rank: number; t: Theme }) {
	const art = BOX_W - 16
	const artH = BOX_H - 16
	return (
		<div style={flex({ position: "relative", width: BOX_W, height: BOX_H, padding: 8, borderRadius: 10, backgroundColor: "#0e0e0f", boxShadow: `0 26px 40px ${alpha("#000000", 0.6)}` })}>
			{item.poster ? (
				<img src={item.poster} width={art} height={artH} style={{ display: "flex", width: art, height: artH, objectFit: "cover", borderRadius: 3 }} />
			) : (
				<div
					style={col({
						width: art,
						height: artH,
						borderRadius: 3,
						justifyContent: "flex-end",
						padding: 22,
						backgroundImage: `linear-gradient(170deg, ${t.accent} 0%, ${t.ink} 100%)`,
						color: "#ffffff",
						fontFamily: "Anton",
						fontSize: fit(item.title, [[12, 56], [24, 42], [999, 32]]),
						lineHeight: 1,
						textTransform: "uppercase",
					})}
				>
					{item.title}
				</div>
			)}
			<div
				style={{
					display: "flex",
					position: "absolute",
					top: 8,
					left: 8,
					width: art,
					height: artH,
					borderRadius: 3,
					backgroundImage: `linear-gradient(118deg, ${alpha("#ffffff", 0.2)} 0%, ${alpha("#ffffff", 0.05)} 26%, ${alpha("#ffffff", 0)} 40%, ${alpha("#ffffff", 0)} 78%, ${alpha("#ffffff", 0.1)} 100%)`,
				}}
			/>
			<div style={{ display: "flex", position: "absolute", top: 8, left: 8, width: art, height: 3, backgroundColor: alpha("#ffffff", 0.35) }} />
			<div
				style={col({
					position: "absolute",
					top: 22,
					right: -18,
					width: 96,
					height: 96,
					borderRadius: 999,
					backgroundColor: t.accent,
					border: "4px solid #ffffff",
					alignItems: "center",
					justifyContent: "center",
					transform: "rotate(-12deg)",
					color: t.ink,
				})}
			>
				<div style={{ display: "flex", fontFamily: "Anton", fontSize: 44, lineHeight: 1 }}>{`#${rank + 1}`}</div>
				<div style={{ display: "flex", fontFamily: "Space Mono", fontWeight: 700, fontSize: 11, letterSpacing: 1.5 }}>STAFF PICK</div>
			</div>
			<div
				style={flex({
					position: "absolute",
					right: 18,
					bottom: 20,
					padding: "3px 8px",
					backgroundColor: "#f5f5f5",
					border: "2px solid #111111",
					fontFamily: "Rubik Mono One",
					fontSize: 16,
					color: "#111111",
					letterSpacing: -0.5,
				})}
			>
				VHS
			</div>
			<div
				style={col({
					position: "absolute",
					left: 20,
					bottom: 28,
					padding: "6px 10px",
					backgroundColor: "#fbfaf4",
					borderTop: `5px solid ${t.accent}`,
					transform: "rotate(-3deg)",
					color: "#1a1a1a",
				})}
			>
				<div style={{ display: "flex", fontFamily: "Space Mono", fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>{(item.genre ?? (item.type === "movie" ? "Movie" : "Series")).toUpperCase().slice(0, 16)}</div>
				<div style={{ display: "flex", fontFamily: "Space Mono", fontSize: 12 }}>3-DAY · $2.99</div>
			</div>
		</div>
	)
}

// The printed label in the shelf's price channel, under each case.
function ShelfLabel({ item, rank, t }: { item: ListItem; rank: number; t: Theme }) {
	return (
		<div style={flex({ width: BOX_W, height: 40, backgroundColor: "#f4f1e8", alignItems: "center", color: "#1a1a1a" })}>
			<div style={flex({ width: 46, height: 40, backgroundColor: t.accent, alignItems: "center", justifyContent: "center", fontFamily: "Anton", fontSize: 24, color: t.ink })}>{String(rank + 1).padStart(2, "0")}</div>
			<div style={{ display: "block", flex: 1, minWidth: 0, paddingLeft: 10, fontFamily: "Space Mono", fontWeight: 700, fontSize: 15, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</div>
			<div style={{ display: "flex", paddingRight: 10, paddingLeft: 6, fontFamily: "Space Mono", fontSize: 13, color: "#6a6a6a" }}>{item.year ?? ""}</div>
		</div>
	)
}

// A cassette lying flat: black shell, window slots, and a paper spine label written by hand.
function Cassette({ label, rank, t, offset }: { label: string; rank: number | null; t: Theme; offset: number }) {
	return (
		<div
			style={flex({
				width: SPINE_W,
				height: SPINE_H,
				marginLeft: offset,
				alignItems: "center",
				padding: "0 16px",
				gap: 14,
				borderRadius: 5,
				backgroundImage: "linear-gradient(180deg, #2a2a2c 0%, #121213 55%, #0a0a0b 100%)",
				borderTop: `1px solid ${alpha("#ffffff", 0.18)}`,
				boxShadow: `0 8px 14px ${alpha("#000000", 0.5)}`,
			})}
		>
			{rank != null ? (
				<div style={flex({ width: 44, height: 44, borderRadius: 999, backgroundColor: t.accent, alignItems: "center", justifyContent: "center", fontFamily: "Anton", fontSize: 24, color: t.ink, flexShrink: 0 })}>{String(rank + 1)}</div>
			) : (
				<div style={flex({ width: 44, height: 44, flexShrink: 0, alignItems: "center", justifyContent: "center", fontFamily: "Space Mono", fontWeight: 700, fontSize: 12, color: alpha("#ffffff", 0.5) })}>T-120</div>
			)}
			<div
				style={flex({
					flex: 1,
					minWidth: 0,
					height: 46,
					alignItems: "center",
					padding: "0 14px",
					backgroundColor: "#f7f3e6",
					backgroundImage: `linear-gradient(180deg, ${alpha("#b8c4d8", 0)} 0%, ${alpha("#b8c4d8", 0)} 48%, ${alpha("#b8c4d8", 0.55)} 50%, ${alpha("#b8c4d8", 0)} 52%)`,
					borderLeft: `6px solid ${t.accent}`,
				})}
			>
				<div
					style={{
						display: "block",
						width: "100%",
						fontFamily: "Permanent Marker",
						fontSize: fit(label, [[14, 30], [22, 25], [32, 21], [999, 18]]),
						lineHeight: 1.2,
						color: "#1c2a5a",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
					}}
				>
					{label}
				</div>
			</div>
			<div style={col({ gap: 6, flexShrink: 0 })}>
				<div style={{ display: "flex", width: 34, height: 6, borderRadius: 3, backgroundColor: alpha("#ffffff", 0.14) }} />
				<div style={{ display: "flex", width: 34, height: 6, borderRadius: 3, backgroundColor: alpha("#ffffff", 0.14) }} />
				<div style={{ display: "flex", width: 34, height: 6, borderRadius: 3, backgroundColor: alpha("#ffffff", 0.14) }} />
			</div>
		</div>
	)
}

export function VhsCard({ title, items, name, theme, date, editing }: CardProps) {
	const t = THEMES[theme]
	const heading = title || "My top 5"
	const faceOut = editing ? 3 : Math.max(1, Math.min(3, items.length))
	const gap = (W - 120 - faceOut * BOX_W) / Math.max(1, faceOut - 1)
	const rowLeft = faceOut === 1 ? (W - BOX_W) / 2 : faceOut === 2 ? (W - 2 * BOX_W - 80) / 2 : 60
	const step = faceOut === 3 ? BOX_W + gap : BOX_W + 80
	const lower = [3, 4].filter((r) => editing || items[r])
	return (
		<div style={col({ position: "relative", width: W, height: H, backgroundColor: "#140f0b", fontFamily: "Gabarito", color: "#ffffff", overflow: "hidden" })}>
			<div
				style={{
					display: "flex",
					position: "absolute",
					top: 0,
					left: 0,
					width: W,
					height: H,
					backgroundImage: `radial-gradient(ellipse at 50% 0%, ${alpha(t.accent, 0.32)} 0%, ${alpha(t.accent, 0)} 55%), linear-gradient(180deg, #1c1611 0%, #0f0b08 100%)`,
				}}
			/>
			<div style={flex({ position: "absolute", top: 34, left: 60, right: 60, justifyContent: "space-between", alignItems: "center" })}>
				<Brand color="#ffffff" size={40} />
				<div style={{ display: "flex", fontFamily: "Space Mono", fontWeight: 700, fontSize: 17, letterSpacing: 4, color: alpha("#ffffff", 0.55) }}>{date.toUpperCase()}</div>
			</div>

			<div style={{ display: "flex", position: "absolute", top: 82, left: 190, width: 3, height: 36, backgroundColor: "#6b6b6b" }} />
			<div style={{ display: "flex", position: "absolute", top: 82, right: 190, width: 3, height: 36, backgroundColor: "#6b6b6b" }} />
			<div
				data-edit="title"
				style={col({
					position: "absolute",
					top: 116,
					left: 60,
					width: 960,
					height: 176,
					padding: "18px 30px",
					justifyContent: "center",
					gap: 6,
					backgroundColor: t.accent,
					border: `4px solid ${t.ink}`,
					boxShadow: `0 18px 40px ${alpha("#000000", 0.5)}`,
					color: t.ink,
				})}
			>
				<div style={{ display: "flex", fontFamily: "Space Mono", fontWeight: 700, fontSize: 18, letterSpacing: 6 }}>STAFF PICKS</div>
				<div style={{ display: "flex", fontFamily: "Anton", fontSize: fit(heading, [[18, 84], [28, 66], [40, 50], [999, 40]]), lineHeight: 0.98, textTransform: "uppercase" }}>{heading}</div>
			</div>

			<Shelf top={SHELF1} />
			<Shelf top={SHELF2} />

			{Array.from({ length: faceOut }, (_, r) => {
				const item = items[r]
				return (
					<div key={item?.key ?? `slot-${r}`} data-slot={r} style={col({ position: "absolute", left: rowLeft + r * step, top: SHELF1 - BOX_H + 6, width: BOX_W, gap: 24 })}>
						{item ? (
							<Clamshell item={item} rank={r} t={t} />
						) : (
							<Placeholder w={BOX_W} h={BOX_H} n={r + 1} color="#ffffff" style={{ borderRadius: 10, backgroundColor: alpha("#ffffff", 0.05) }} />
						)}
						{item ? <ShelfLabel item={item} rank={r} t={t} /> : <div style={{ display: "flex", height: 40 }} />}
					</div>
				)
			})}

			<div style={col({ position: "absolute", left: 50, top: SHELF2 - SPINE_H * 2 - 4 + (lower.length === 1 ? SPINE_H + 4 : 0), gap: 4 })}>
				{lower.length ? (
					lower.map((r, i) => {
						const item = items[r]
						return (
							<div key={item?.key ?? `slot-${r}`} data-slot={r} style={flex({})}>
								{item ? (
									<Cassette label={item.title} rank={r} t={t} offset={i === 0 ? 0 : 22} />
								) : (
									<Placeholder w={SPINE_W} h={SPINE_H} n={r + 1} color="#ffffff" style={{ marginLeft: i === 0 ? 0 : 22, borderRadius: 5, backgroundColor: alpha("#ffffff", 0.05), fontSize: 20 }} />
								)}
							</div>
						)
					})
				) : (
					<div style={col({ gap: 4 })}>
						<Cassette label="your top 5 goes here" rank={null} t={t} offset={18} />
						<Cassette label="blank · record your own" rank={null} t={t} offset={0} />
					</div>
				)}
			</div>

			<div style={{ display: "flex", position: "absolute", left: 712, top: 1020, width: 310, height: 166, backgroundColor: alpha("#000000", 0.35), transform: "rotate(3deg) translate(8px, 10px)" }} />
			<div
				data-edit="name"
				style={col({
					position: "absolute",
					left: 712,
					top: 1020,
					width: 310,
					height: 166,
					padding: "20px 22px",
					gap: 6,
					backgroundColor: "#fbf7ea",
					borderTop: `12px solid ${t.accent}`,
					transform: "rotate(3deg)",
					color: "#1a1a1a",
				})}
			>
				<div style={{ display: "flex", fontFamily: "Space Mono", fontWeight: 700, fontSize: 15, letterSpacing: 3, color: "#555555" }}>STAFF PICK BY</div>
				<div style={{ display: "flex", fontFamily: "Permanent Marker", fontSize: fit(name || "someone with taste", [[12, 34], [20, 27], [999, 21]]), lineHeight: 1.1, color: "#1c2a5a" }}>{name || "someone with taste"}</div>
				<div style={{ display: "flex", fontFamily: "Space Mono", fontSize: 14, color: "#555555", marginTop: 4 }}>be kind · rewind</div>
			</div>
			<div style={{ display: "flex", position: "absolute", left: 830, top: 1006, width: 76, height: 26, backgroundColor: alpha("#fff7d6", 0.6), transform: "rotate(-4deg)" }} />

			<div style={flex({ position: "absolute", left: 60, right: 60, bottom: 26, justifyContent: "space-between", alignItems: "center" })}>
				<div style={{ display: "flex", fontFamily: "Space Mono", fontWeight: 700, fontSize: 17, letterSpacing: 4, color: alpha("#ffffff", 0.5) }}>{`${items.length} ${items.length === 1 ? "TITLE" : "TITLES"}`}</div>
				<div style={{ display: "flex", fontSize: 28, fontWeight: 900 }}>goodwatch.app</div>
			</div>
		</div>
	)
}

export const vhs: Design = { key: "vhs", name: "VHS shelf", format: "Post 4:5", w: W, h: H, max: 5, Card: VhsCard }
