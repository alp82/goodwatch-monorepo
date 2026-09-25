// "Podium": a 9:16 story. The #1 pick's backdrop bleeds in from the top, a condensed
// poster-type title, the winner gets a hero row with a giant numeral, the rest line up below.
import { alpha, Brand, col, fit, flex, Img, kind, Placeholder } from "../kit"
import { type CardDesign, type CardProps, THEMES } from "../model"

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
						<div style={{ display: "flex", fontSize: 38, fontWeight: 900, color: t.accent2 }}>{name || "someone with taste"}</div>
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

export const podium: CardDesign = { key: "podium", name: "Podium", format: "Story 9:16", w: 1080, h: 1920, Card: PodiumCard }
