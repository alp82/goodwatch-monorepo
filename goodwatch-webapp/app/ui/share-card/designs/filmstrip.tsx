// "Film strip": a 35mm negative strip laid on a glowing light table.
// Each pick is a frame (its backdrop still), with Kodak-style edge print that says GOODWATCH.
// The list title runs vertically up the table like a label on the sleeve.
import { alpha, Brand, col, fit, flex, Img, pad } from "../kit"
import { type CardProps, type CardDesign, THEMES } from "../model"

const W = 1080
const H = 1920
const STRIP_X = 340
const STRIP_W = 680
const MARGIN = 72
const FRAME_W = STRIP_W - MARGIN * 2
const FRAME_H = 300
const BLOCK = 372
const FILM = "#121110"

function FilmstripCard({ title, items, name, theme, date, editing }: CardProps) {
	const t = THEMES[theme]
	const heading = (title || "My top 5").toUpperCase()
	const top = Math.round((H - BLOCK * 5) / 2) + 14
	const holes = Array.from({ length: Math.ceil(H / 56) + 1 }, (_, i) => i * 56 - 20)
	return (
		<div style={col({ position: "relative", width: W, height: H, backgroundColor: t.paper, color: t.ink, fontFamily: "Gabarito", overflow: "hidden" })}>
			<div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: W, height: H, backgroundImage: `radial-gradient(circle at 60% 50%, #ffffff 0%, ${alpha("#ffffff", 0)} 70%)` }} />
			{Array.from({ length: 9 }, (_, i) => (
				<div key={`g${i}`} style={{ display: "flex", position: "absolute", top: 0, left: i * 135, width: 1, height: H, backgroundColor: alpha(t.ink, 0.06) }} />
			))}

			<div style={flex({ position: "absolute", left: 44, top: 60 })}>
				<Brand color={t.ink} size={40} />
			</div>

			<div
				style={flex({
					position: "absolute",
					left: 175 - 720,
					top: 960 - 130,
					width: 1440,
					height: 260,
					alignItems: "center",
					justifyContent: "center",
					transform: "rotate(-90deg)",
				})}
			>
				<div
					data-edit="title"
					style={{
						display: "flex",
						fontFamily: "Rubik Mono One",
						fontSize: fit(heading, [[10, 132], [16, 100], [24, 76], [36, 58], [52, 46], [999, 38]]),
						lineHeight: 1.05,
						textAlign: "center",
						justifyContent: "center",
						color: t.ink,
					}}
				>
					{heading}
				</div>
			</div>
			<div style={{ display: "flex", position: "absolute", left: 312, top: 240, width: 8, height: 1440, backgroundColor: t.accent }} />

			<div style={col({ position: "absolute", left: 44, bottom: 56, width: 250, gap: 6 })}>
				<div style={{ display: "flex", fontFamily: "Space Mono", fontSize: 18, letterSpacing: 3, color: alpha(t.ink, 0.55) }}>DEVELOPED BY</div>
				<div style={{ display: "flex", fontSize: fit(name || "someone with taste", [[14, 32], [20, 24], [999, 19]]), fontWeight: 900, lineHeight: 1.05, maxWidth: 270, overflow: "hidden" }}>
					{name || "someone with taste"}
				</div>
				<div style={{ display: "flex", fontFamily: "Space Mono", fontSize: 18, marginTop: 10, color: alpha(t.ink, 0.55) }}>{date.toUpperCase()}</div>
				<div style={{ display: "flex", fontSize: 26, fontWeight: 900 }}>goodwatch.app</div>
			</div>

			<div style={col({ position: "absolute", left: STRIP_X, top: 0, width: STRIP_W, height: H, backgroundColor: FILM, boxShadow: `0 0 60px ${alpha(t.ink, 0.35)}` })}>
				{holes.map((y) => (
					<div key={`l${y}`} style={{ display: "flex", position: "absolute", left: 20, top: y, width: 34, height: 26, borderRadius: 6, backgroundColor: t.paper }} />
				))}
				{holes.map((y) => (
					<div key={`r${y}`} style={{ display: "flex", position: "absolute", left: STRIP_W - 54, top: y, width: 34, height: 26, borderRadius: 6, backgroundColor: t.paper }} />
				))}

				{Array.from({ length: 5 }, (_, i) => {
					const item = items[i]
					const y = top + i * BLOCK
					const still = item?.backdrop ?? item?.poster ?? null
					return (
						<div key={item?.key ?? `f${i}`} style={col({ position: "absolute", left: MARGIN, top: y, width: FRAME_W })}>
							{item ? (
								<div data-slot={i} style={col({ width: FRAME_W })}>
									<div style={flex({ position: "relative", width: FRAME_W, height: FRAME_H, borderRadius: 8, overflow: "hidden", backgroundColor: "#2a2724" })}>
										{still ? (
											<Img src={still} w={FRAME_W} h={FRAME_H} />
										) : (
											<div style={flex({ width: FRAME_W, height: FRAME_H, alignItems: "center", justifyContent: "center", padding: 30, fontFamily: "Rubik Mono One", fontSize: 34, color: alpha("#ffffff", 0.5), textAlign: "center" })}>
												{item.title.toUpperCase()}
											</div>
										)}
										<div
											style={flex({
												position: "absolute",
												left: 16,
												top: 16,
												height: 54,
												padding: "0 16px",
												alignItems: "center",
												borderRadius: 6,
												backgroundColor: t.accent,
												color: t.ink,
												fontFamily: "Rubik Mono One",
												fontSize: 30,
											})}
										>
											{pad(i + 1)}
										</div>
									</div>
									<div style={flex({ height: 64, alignItems: "center", justifyContent: "space-between", gap: 20, color: "#f4efe6" })}>
										<div style={{ display: "flex", flex: 1, fontWeight: 700, fontSize: fit(item.title, [[24, 32], [34, 26], [999, 22]]), lineHeight: 1.1, overflow: "hidden", maxHeight: 54 }}>
											{item.title}
										</div>
										<div style={{ display: "flex", fontFamily: "Space Mono", fontSize: 22, color: alpha("#f4efe6", 0.55) }}>{item.year ? String(item.year) : ""}</div>
									</div>
								</div>
							) : editing ? (
								<div
									data-slot={i}
									style={col({ width: FRAME_W, height: FRAME_H, alignItems: "center", justifyContent: "center", borderRadius: 8, border: `4px dashed ${alpha("#ffffff", 0.35)}`, color: alpha("#ffffff", 0.55), fontFamily: "Space Mono", fontSize: 26, letterSpacing: 3 })}
								>
									<div style={{ display: "flex", fontFamily: "Rubik Mono One", fontSize: 54 }}>{pad(i + 1)}</div>
									<div style={{ display: "flex" }}>ADD A FRAME</div>
								</div>
							) : (
								<div style={{ display: "flex", width: FRAME_W, height: FRAME_H, borderRadius: 8, backgroundColor: "#1c1a18" }} />
							)}
						</div>
					)
				})}

				{Array.from({ length: 5 }, (_, i) => (
					<div
						key={`e${i}`}
						style={flex({
							position: "absolute",
							left: STRIP_W - 14 - 170,
							top: top + i * BLOCK + FRAME_H / 2 - 10,
							width: 340,
							height: 20,
							justifyContent: "center",
							transform: "rotate(90deg)",
							fontFamily: "Space Mono",
							fontWeight: 700,
							fontSize: 14,
							letterSpacing: 3,
							color: t.accent,
						})}
					>
						{`GOODWATCH 5219  >  ${pad(i + 1)}A`}
					</div>
				))}
				{Array.from({ length: 5 }, (_, i) => (
					<div
						key={`k${i}`}
						style={flex({
							position: "absolute",
							left: 14 - 170,
							top: top + i * BLOCK + FRAME_H / 2 - 10,
							width: 340,
							height: 20,
							justifyContent: "center",
							transform: "rotate(-90deg)",
							fontFamily: "Space Mono",
							fontSize: 14,
							letterSpacing: 3,
							color: alpha(t.accent, 0.7),
						})}
					>
						{`${pad(i * 6 + 12)}  SAFETY FILM  ${pad(i * 6 + 13)}`}
					</div>
				))}
			</div>
		</div>
	)
}

export const filmstrip: CardDesign = { key: "filmstrip", name: "Film strip", format: "Story 9:16", w: W, h: H, Card: FilmstripCard }
