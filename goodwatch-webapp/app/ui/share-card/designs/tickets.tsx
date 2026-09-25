// "Tickets": each pick is a cinema ticket stub, fanned down a dark lobby
// under a projector beam. Rank is the row on the stub; the poster sits on the ticket body.
import { alpha, Brand, col, fit, flex, Img, kind, pad } from "../kit"
import { type CardProps, type CardDesign, hash, THEMES } from "../model"

const W = 1080
const H = 1920
const TICKET_W = 940

function TicketsCard({ title, items, name, theme, date, editing }: CardProps) {
	const t = THEMES[theme]
	const count = editing ? 5 : Math.max(1, Math.min(items.length, 5))
	const th = Math.min(300, Math.floor((1230 - (count - 1) * 30) / count))
	const ph = th - 36
	const pw = Math.round(ph / 1.5)
	const seed = hash(items.map((i) => i.key).join() + title)
	const heading = title || "My top 5"
	return (
		<div style={col({ position: "relative", width: W, height: H, backgroundColor: t.ink, color: "#fff", fontFamily: "Gabarito", overflow: "hidden" })}>
			<div style={{ display: "flex", position: "absolute", top: -500, left: -260, width: 1600, height: 1400, backgroundImage: `radial-gradient(ellipse at 50% 30%, ${alpha(t.accent, 0.32)} 0%, ${alpha(t.accent, 0)} 60%)` }} />
			<div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: W, height: H, backgroundImage: `linear-gradient(180deg, ${alpha(t.ink, 0)} 55%, ${alpha("#000000", 0.55)} 100%)` }} />

			<div style={col({ position: "relative", width: W, height: H, padding: "76px 70px 64px" })}>
				<div style={flex({ justifyContent: "space-between", alignItems: "center" })}>
					<Brand color="#fff" size={46} />
					<div style={flex({ border: `3px solid ${t.accent}`, color: t.accent, fontFamily: "Space Mono", fontWeight: 700, fontSize: 22, letterSpacing: 5, padding: "8px 18px", borderRadius: 6 })}>
						NOW SHOWING
					</div>
				</div>
				<div
					data-edit="title"
					style={{ display: "flex", marginTop: 48, fontFamily: "Playfair Display", fontStyle: "italic", fontWeight: 900, fontSize: fit(heading, [[14, 124], [24, 104], [38, 84], [56, 68], [999, 56]]), lineHeight: 1.02, letterSpacing: -1 }}
				>
					{heading}
				</div>
				<div style={flex({ marginTop: 22, gap: 18, alignItems: "center", fontFamily: "Space Mono", fontSize: 22, letterSpacing: 4, color: alpha("#ffffff", 0.6) })}>
					<div style={{ display: "flex", width: 60, height: 4, backgroundColor: t.accent }} />
					<div style={{ display: "flex" }}>{`${date.toUpperCase()} · ${count} ${count === 1 ? "FEATURE" : "FEATURES"}`}</div>
				</div>

				<div style={col({ flexGrow: 1, justifyContent: "center", alignItems: "center", gap: 30 })}>
					{Array.from({ length: count }, (_, i) => {
						const item = items[i]
						const rot = i % 2 === 0 ? -1.6 : 1.3
						const shift = i % 2 === 0 ? -18 : 18
						if (!item) {
							return (
								<div
									key={`empty-${i}`}
									data-slot={i}
									style={col({
										width: TICKET_W,
										height: th,
										alignItems: "center",
										justifyContent: "center",
										borderRadius: 18,
										border: `4px dashed ${alpha("#ffffff", 0.4)}`,
										color: alpha("#ffffff", 0.6),
										fontFamily: "Space Mono",
										fontSize: 28,
										letterSpacing: 4,
										transform: `translateX(${shift}px) rotate(${rot}deg)`,
									})}
								>
									<div style={{ display: "flex" }}>{`ROW ${pad(i + 1)} · ADD A TITLE`}</div>
								</div>
							)
						}
						const bars = Array.from({ length: 22 }, (_, b) => 2 + ((((seed >>> (b % 23)) ^ (b * 131 + i * 17)) >>> 0) % 5))
						return (
							<div key={item.key} data-slot={i} style={flex({ position: "relative", width: TICKET_W, height: th, transform: `translateX(${shift}px) rotate(${rot}deg)` })}>
								<div style={col({ width: 196, height: th, backgroundColor: t.accent, color: t.ink, justifyContent: "space-between", alignItems: "center", padding: "20px 0", borderRadius: "18px 0 0 18px" })}>
									<div style={{ display: "flex", fontFamily: "Space Mono", fontWeight: 700, fontSize: 17, letterSpacing: 3 }}>ADMIT ONE</div>
									<div style={col({ alignItems: "center" })}>
										<div style={{ display: "flex", fontFamily: "Space Mono", fontWeight: 700, fontSize: 18, letterSpacing: 4, opacity: 0.7 }}>ROW</div>
										<div style={{ display: "flex", fontFamily: "Anton", fontSize: Math.min(120, th * 0.46), lineHeight: 1 }}>{pad(i + 1)}</div>
									</div>
									<div style={{ display: "flex", fontFamily: "Space Mono", fontSize: 17, letterSpacing: 2 }}>{`SEAT ${String.fromCharCode(65 + i)}${(seed >>> i) % 20 + 1}`}</div>
								</div>
								<div style={col({ width: 4, height: th, justifyContent: "space-around", alignItems: "center", backgroundColor: t.paper })}>
									{Array.from({ length: Math.floor(th / 22) }, (_, d) => (
										<div key={d} style={{ display: "flex", width: 4, height: 10, backgroundColor: alpha(t.ink, 0.35) }} />
									))}
								</div>
								<div style={flex({ flex: 1, height: th, backgroundColor: t.paper, color: t.ink, padding: 18, gap: 24, borderRadius: "0 18px 18px 0" })}>
									<Img src={item.poster} w={pw} h={ph} style={{ borderRadius: 8, backgroundColor: alpha(t.ink, 0.15) }} />
									<div style={col({ flex: 1, justifyContent: "space-between", padding: "4px 0" })}>
										<div style={{ display: "flex", fontFamily: "Space Mono", fontWeight: 700, fontSize: 16, letterSpacing: 4, color: alpha(t.ink, 0.55) }}>
											{`GOODWATCH CINEMA · ${kind(item).toUpperCase()}`}
										</div>
										<div
											style={{
												display: "flex",
												fontFamily: "Playfair Display",
												fontWeight: 900,
												fontSize: fit(item.title, [[12, th > 220 ? 56 : 46], [22, th > 220 ? 46 : 38], [36, 34], [999, 28]]),
												lineHeight: 1.02,
												maxHeight: ph - 80,
												overflow: "hidden",
											}}
										>
											{item.title}
										</div>
										<div style={flex({ justifyContent: "space-between", alignItems: "flex-end" })}>
											<div style={flex({ gap: 10, fontFamily: "Space Mono", fontWeight: 700, fontSize: 18 })}>
												{item.year && <div style={flex({ border: `2px solid ${t.ink}`, borderRadius: 4, padding: "2px 10px" })}>{String(item.year)}</div>}
												{item.score != null && <div style={flex({ backgroundColor: t.ink, color: t.paper, borderRadius: 4, padding: "2px 10px" })}>{`GW ${item.score}`}</div>}
											</div>
											<div style={flex({ alignItems: "flex-end", gap: 2, height: 36 })}>
												{bars.map((w, b) => (
													<div key={b} style={{ display: "flex", width: w, height: b % 7 === 0 ? 36 : 30, backgroundColor: b % 3 === 2 ? t.paper : t.ink }} />
												))}
											</div>
										</div>
									</div>
								</div>
								<div style={{ display: "flex", position: "absolute", left: 178, top: -18, width: 40, height: 36, borderRadius: 999, backgroundColor: t.ink }} />
								<div style={{ display: "flex", position: "absolute", left: 178, bottom: -18, width: 40, height: 36, borderRadius: 999, backgroundColor: t.ink }} />
							</div>
						)
					})}
				</div>

				<div style={flex({ justifyContent: "space-between", alignItems: "flex-end", paddingTop: 30, borderTop: `2px dashed ${alpha("#ffffff", 0.25)}` })}>
					<div style={col({ gap: 6 })}>
						<div style={{ display: "flex", fontFamily: "Space Mono", fontSize: 20, letterSpacing: 4, color: alpha("#ffffff", 0.5) }}>TICKETS ISSUED TO</div>
						<div data-edit="name" style={{ display: "flex", fontSize: 38, fontWeight: 900, color: t.accent }}>
							{name || "someone with taste"}
						</div>
					</div>
					<div style={col({ alignItems: "flex-end", gap: 6 })}>
						<div style={{ display: "flex", fontFamily: "Space Mono", fontSize: 20, letterSpacing: 4, color: alpha("#ffffff", 0.5) }}>BOX OFFICE</div>
						<div style={{ display: "flex", fontSize: 38, fontWeight: 900 }}>goodwatch.app</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export const tickets: CardDesign = { key: "tickets", name: "Tickets", format: "Story 9:16", w: W, h: H, Card: TicketsCard }
