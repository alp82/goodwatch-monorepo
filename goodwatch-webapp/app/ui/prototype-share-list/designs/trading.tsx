// PROTOTYPE - throwaway. "Trading cards": the list as a set of collectible cards. #1 is the
// holo pull up front; #2–#5 stand in a row behind it with their name bars and art visible.
// Each card has the classic anatomy: name bar with a stat, landscape art window, type line with
// a rarity symbol, a stat box with flavor text, and a collector number. 9:16 story.
import type { CSSProperties } from "react"
import { alpha, Brand, col, fit, flex, Placeholder } from "../kit"
import { type CardProps, type Design, type ListItem, THEMES } from "../model"

const W = 1080
const H = 1920
const RATIO = 88 / 63 // real trading card proportions
const HERO_W = 660
const BACK_W = 258
const BACK_TOP = 410

type Theme = (typeof THEMES)[keyof typeof THEMES]

const holo = (t: Theme) => `linear-gradient(135deg, ${t.accent} 0%, #ffffff 22%, ${t.accent2} 42%, #ffffff 60%, ${t.accent} 80%, ${t.accent2} 100%)`
const RARITY = ["Legendary", "Rare", "Rare", "Uncommon", "Uncommon"]

// Rarity symbol drawn with shapes (no glyphs): diamond in a ring, diamond, or dot.
function Rarity({ rank, t, k }: { rank: number; t: Theme; k: number }) {
	const s = 26 * k
	if (rank === 0)
		return (
			<div style={flex({ width: s, height: s, borderRadius: 999, backgroundImage: holo(t), alignItems: "center", justifyContent: "center", border: `${Math.max(1, 2 * k)}px solid ${t.ink}` })}>
				<div style={{ display: "flex", width: s * 0.38, height: s * 0.38, backgroundColor: t.ink, transform: "rotate(45deg)" }} />
			</div>
		)
	if (rank < 3) return <div style={{ display: "flex", width: s * 0.62, height: s * 0.62, margin: s * 0.19, backgroundColor: t.ink, transform: "rotate(45deg)" }} />
	return <div style={{ display: "flex", width: s * 0.6, height: s * 0.6, margin: s * 0.2, borderRadius: 999, backgroundColor: t.ink }} />
}

function Stat({ label, value, k, ink }: { label: string; value: string; k: number; ink: string }) {
	return (
		<div style={flex({ alignItems: "flex-end", gap: 8 * k })}>
			<div style={{ display: "flex", fontFamily: "Space Mono", fontWeight: 700, fontSize: 15 * k, letterSpacing: 1.5 * k, color: alpha(ink, 0.6) }}>{label}</div>
			<div style={{ display: "flex", flex: 1, height: 1.5 * k, marginBottom: 6 * k, backgroundColor: alpha(ink, 0.18) }} />
			<div style={{ display: "flex", fontFamily: "Gabarito", fontWeight: 900, fontSize: 22 * k, lineHeight: 1, color: ink }}>{value}</div>
		</div>
	)
}

// One card at width w. Everything scales with k so the back row is a true miniature of the hero.
function Collectible({ item, rank, total, t, w, name, date }: { item: ListItem; rank: number; total: number; t: Theme; w: number; name: string; date: string }) {
	const k = w / HERO_W
	const h = Math.round(w * RATIO)
	const hero = rank === 0
	const border = Math.max(9, 14 * k)
	const inner = w - border * 2
	const padX = 16 * k
	const artW = inner - padX * 2
	const artH = Math.round(artW * 0.74)
	const ink = t.ink
	const type = [item.type === "movie" ? "Movie" : "Series", item.genre].filter(Boolean).join(" — ")
	const art = item.backdrop ?? item.poster
	const shadow = hero ? `0 40px 90px ${alpha("#000000", 0.65)}` : `0 18px 40px ${alpha("#000000", 0.55)}`
	const frame: CSSProperties = hero
		? { backgroundImage: `linear-gradient(180deg, ${t.paper} 0%, ${alpha(t.accent2, 0.9)} 100%)` }
		: { backgroundColor: t.paper }
	return (
		<div
			style={col({
				width: w,
				height: h,
				padding: border,
				borderRadius: 26 * k,
				backgroundImage: hero ? holo(t) : "linear-gradient(145deg, #3b3b40 0%, #16161a 55%, #2b2b30 100%)",
				boxShadow: shadow,
			})}
		>
			<div style={col({ flex: 1, borderRadius: 16 * k, padding: `${14 * k}px ${padX}px ${10 * k}px`, gap: 10 * k, color: ink, ...frame })}>
				<div
					style={flex({
						alignItems: "center",
						gap: 10 * k,
						height: 56 * k,
						padding: `0 ${14 * k}px`,
						borderRadius: 12 * k,
						backgroundImage: `linear-gradient(180deg, #ffffff 0%, ${alpha(t.paper, 0.6)} 100%)`,
						border: `${Math.max(1, 2 * k)}px solid ${alpha(ink, 0.25)}`,
					})}
				>
					<div
						style={{
							display: "block",
							flex: 1,
							minWidth: 0,
							fontFamily: "Gabarito",
							fontWeight: 900,
							fontSize: fit(item.title, [[16, 30], [24, 25], [34, 21], [999, 18]]) * k,
							lineHeight: 1.1,
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
						}}
					>
						{item.title}
					</div>
					{item.score != null && (
						<div style={flex({ alignItems: "center", gap: 6 * k, flexShrink: 0 })}>
							<div style={{ display: "flex", fontFamily: "Space Mono", fontWeight: 700, fontSize: 14 * k, color: alpha(ink, 0.65) }}>GW</div>
							<div style={{ display: "flex", fontFamily: "Rubik Mono One", fontSize: 28 * k, lineHeight: 1 }}>{String(item.score)}</div>
							<div style={{ display: "flex", width: 22 * k, height: 22 * k, borderRadius: 999, backgroundColor: t.accent, border: `${Math.max(1, 2 * k)}px solid ${ink}` }} />
						</div>
					)}
				</div>

				<div
					style={flex({
						position: "relative",
						padding: 5 * k,
						backgroundImage: hero ? holo(t) : "linear-gradient(145deg, #d8d8dc 0%, #7a7a82 50%, #cfcfd4 100%)",
						boxShadow: `0 ${3 * k}px ${8 * k}px ${alpha("#000000", 0.25)}`,
					})}
				>
					{art ? (
						<img src={art} width={artW - 10 * k} height={artH} style={{ display: "flex", width: artW - 10 * k, height: artH, objectFit: "cover", objectPosition: "center top" }} />
					) : (
						<div
							style={col({
								width: artW - 10 * k,
								height: artH,
								justifyContent: "flex-end",
								padding: 20 * k,
								backgroundImage: `linear-gradient(160deg, ${t.accent} 0%, ${t.accent2} 100%)`,
								color: t.ink,
								fontFamily: "Anton",
								fontSize: fit(item.title, [[12, 60], [24, 46], [999, 34]]) * k,
								lineHeight: 1,
								textTransform: "uppercase",
							})}
						>
							{item.title}
						</div>
					)}
					{hero && (
						<div
							style={{
								display: "flex",
								position: "absolute",
								top: 5 * k,
								left: 5 * k,
								width: artW - 10 * k,
								height: artH,
								backgroundImage: `linear-gradient(120deg, ${alpha("#ffffff", 0)} 18%, ${alpha("#ffffff", 0.28)} 34%, ${alpha(t.accent2, 0.3)} 46%, ${alpha(t.accent, 0.22)} 56%, ${alpha("#ffffff", 0)} 72%)`,
							}}
						/>
					)}
				</div>

				<div
					style={flex({
						alignItems: "center",
						justifyContent: "space-between",
						height: 38 * k,
						padding: `0 ${12 * k}px`,
						borderRadius: 8 * k,
						backgroundImage: `linear-gradient(180deg, #ffffff 0%, ${alpha(t.paper, 0.5)} 100%)`,
						border: `${Math.max(1, 1.5 * k)}px solid ${alpha(ink, 0.2)}`,
					})}
				>
					<div style={{ display: "flex", fontFamily: "Gabarito", fontWeight: 700, fontSize: 17 * k, letterSpacing: 0.5 * k, whiteSpace: "nowrap", overflow: "hidden" }}>
						{`${type}${item.year ? `  ·  ${item.year}` : ""}`}
					</div>
					<Rarity rank={rank} t={t} k={k} />
				</div>

				<div style={col({ flex: 1, padding: `${14 * k}px ${16 * k}px`, gap: 10 * k, borderRadius: 8 * k, backgroundColor: alpha("#ffffff", 0.55), border: `${Math.max(1, 1.5 * k)}px solid ${alpha(ink, 0.15)}` })}>
					<Stat label="RANK" value={`#${rank + 1} of ${total}`} k={k} ink={ink} />
					<Stat label="RELEASED" value={item.year ? String(item.year) : "—"} k={k} ink={ink} />
					<Stat label="RARITY" value={RARITY[rank]} k={k} ink={ink} />
					<div style={{ display: "flex", height: 1.5 * k, marginTop: 4 * k, backgroundColor: alpha(ink, 0.15) }} />
					<div style={{ display: "flex", fontFamily: "Instrument Serif", fontStyle: "italic", fontSize: 24 * k, lineHeight: 1.2, color: alpha(ink, 0.8) }}>
						{`“Pulled at #${rank + 1} by ${name || "someone with taste"}.”`}
					</div>
				</div>

				<div style={flex({ justifyContent: "space-between", alignItems: "center", fontFamily: "Space Mono", fontWeight: 700, fontSize: 13 * k, letterSpacing: 1 * k, color: alpha(ink, 0.6) })}>
					<div style={{ display: "flex" }}>{`GW${date.slice(-2)} · ${String(rank + 1).padStart(3, "0")}/${String(total).padStart(3, "0")}`}</div>
					<div style={{ display: "flex", color: hero ? ink : alpha(ink, 0.6) }}>{hero ? "HOLO FOIL" : RARITY[rank].toUpperCase()}</div>
					<div style={{ display: "flex" }}>© GOODWATCH</div>
				</div>
			</div>
		</div>
	)
}

export function TradingCard({ title, items, name, theme, date, editing }: CardProps) {
	const t = THEMES[theme]
	const count = editing ? 5 : Math.max(1, Math.min(5, items.length))
	const heading = title || "My top 5"
	const backs = Array.from({ length: count - 1 }, (_, i) => i + 1)
	const backH = Math.round(BACK_W * RATIO)
	const heroH = Math.round(HERO_W * RATIO)
	const rowW = backs.length * BACK_W
	const rowLeft = (W - rowW) / 2
	const heroTop = backs.length ? 650 : 470
	const hero = items[0]
	return (
		<div style={col({ position: "relative", width: W, height: H, backgroundColor: t.ink, fontFamily: "Gabarito", color: "#fff", overflow: "hidden" })}>
			<div
				style={{
					display: "flex",
					position: "absolute",
					top: 0,
					left: 0,
					width: W,
					height: H,
					backgroundImage: `radial-gradient(circle at 50% 62%, ${alpha(t.accent, 0.5)} 0%, ${alpha(t.accent, 0)} 45%), radial-gradient(circle at 50% 22%, ${alpha(t.accent2, 0.22)} 0%, ${alpha(t.accent2, 0)} 40%)`,
				}}
			/>
			<div style={flex({ position: "absolute", top: 70, left: 70, right: 70, justifyContent: "space-between", alignItems: "center" })}>
				<Brand color="#ffffff" size={48} />
			</div>
			<div style={col({ position: "absolute", top: 180, left: 70, width: 940, gap: 12 })}>
				<div
					data-edit="title"
					style={{ display: "flex", fontFamily: "Anton", fontSize: fit(heading, [[14, 118], [24, 96], [38, 72], [999, 56]]), lineHeight: 0.95, textTransform: "uppercase", textShadow: `0 10px 40px ${alpha("#000000", 0.5)}` }}
				>
					{heading}
				</div>
			</div>

			{backs.map((r, i) => {
				const item = items[r]
				const mid = (backs.length - 1) / 2
				const rot = (i - mid) * 4.5
				const dy = Math.abs(i - mid) * 18
				return (
					<div key={item?.key ?? `slot-${r}`} data-slot={r} style={flex({ position: "absolute", left: rowLeft + i * BACK_W, top: BACK_TOP + dy, width: BACK_W, height: backH, transform: `rotate(${rot}deg)` })}>
						{item ? (
							<Collectible item={item} rank={r} total={count} t={t} w={BACK_W} name={name} date={date} />
						) : (
							<Placeholder w={BACK_W} h={backH} n={r + 1} color="#ffffff" style={{ borderRadius: 12, backgroundColor: alpha("#ffffff", 0.06) }} />
						)}
					</div>
				)
			})}

			<div data-slot={0} style={flex({ position: "absolute", left: (W - HERO_W) / 2, top: heroTop, width: HERO_W, height: heroH })}>
				{hero ? (
					<Collectible item={hero} rank={0} total={count} t={t} w={HERO_W} name={name} date={date} />
				) : (
					<Placeholder w={HERO_W} h={heroH} n={1} color="#ffffff" style={{ borderRadius: 26, backgroundColor: alpha("#ffffff", 0.06) }} />
				)}
			</div>

			{!editing && items.length > 1 && (
				<div style={col({ position: "absolute", left: 70, right: 70, top: heroTop + heroH + 44, gap: 12 })}>
					<div style={{ display: "flex", fontFamily: "Space Mono", fontWeight: 700, fontSize: 18, letterSpacing: 4, color: alpha("#ffffff", 0.5) }}>SET CHECKLIST</div>
					<div style={flex({ flexWrap: "wrap", columnGap: 28, rowGap: 8 })}>
						{items.slice(0, 5).map((item, i) => (
							<div key={item.key} style={flex({ alignItems: "center", gap: 10, fontSize: 24, fontWeight: 700 })}>
								<div style={{ display: "flex", width: 20, height: 20, borderRadius: 4, border: `2px solid ${t.accent}`, backgroundColor: t.accent }} />
								<div style={{ display: "flex", fontFamily: "Space Mono", fontSize: 18, color: alpha("#ffffff", 0.5) }}>{String(i + 1).padStart(3, "0")}</div>
								<div style={{ display: "flex" }}>{item.title}</div>
							</div>
						))}
					</div>
				</div>
			)}

			<div style={flex({ position: "absolute", left: 70, right: 70, bottom: 64, justifyContent: "space-between", alignItems: "center", paddingTop: 24, borderTop: `2px solid ${alpha("#ffffff", 0.15)}` })}>
				<div data-edit="name" style={col({ gap: 2 })}>
					<div style={{ display: "flex", fontFamily: "Space Mono", fontWeight: 700, fontSize: 18, letterSpacing: 3, color: alpha("#ffffff", 0.5) }}>PULLED BY</div>
					<div style={{ display: "flex", fontSize: 34, fontWeight: 900, color: t.accent2 }}>{name || "someone with taste"}</div>
				</div>
				<div style={col({ alignItems: "flex-end", gap: 2 })}>
					<div style={{ display: "flex", fontFamily: "Space Mono", fontWeight: 700, fontSize: 18, letterSpacing: 3, color: alpha("#ffffff", 0.5) }}>OPEN YOUR PACK</div>
					<div style={{ display: "flex", fontSize: 34, fontWeight: 900 }}>goodwatch.app</div>
				</div>
			</div>
		</div>
	)
}

export const trading: Design = { key: "trading", name: "Trading cards", format: "Story 9:16", w: W, h: H, max: 5, Card: TradingCard }
