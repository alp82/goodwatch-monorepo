// The /u/<handle> card: on the amber panel the member's picture, @handle, viewer type and three numbers; on a dark
// panel their favorites' posters (when their scores are public). Everything axis-aligned: resvg can crash on rotated
// elements with blurred shadows.
import {
	Brand,
	Frame,
	INK,
	Picture,
	Tag,
	col,
	fitFontSize,
	row,
} from "~/ui/og-image/parts"

export interface OgProfileContent {
	kind: "profile"
	handle: string
	/** The viewer type, "The originality seeker"; null when the taste isn't public or not formed. */
	persona: string | null
	/** A data URI (the renderer inlines it); null draws the initial. */
	avatar: string | null
	/** The initial's gradient: from, to, ink. */
	avatarColors: [string, string, string]
	/** Up to six favorites' posters; empty when the scores aren't public. */
	posters: (string | null)[]
	/** Up to three numbers with their words: "996" / "seen". */
	stats: { value: string; label: string }[]
}

const PANEL_LEFT = 700
const POSTER_W = 138
const POSTER_H = 207
const GAP = 14

function Avatar({
	content,
	size,
}: { content: OgProfileContent; size: number }) {
	const [from, to, ink] = content.avatarColors
	return content.avatar ? (
		<img
			alt=""
			src={content.avatar}
			style={{
				width: size,
				height: size,
				borderRadius: size,
				objectFit: "cover",
				objectPosition: "center top",
				border: `6px solid ${INK}`,
			}}
		/>
	) : (
		<div
			style={{
				display: "flex",
				width: size,
				height: size,
				borderRadius: size,
				alignItems: "center",
				justifyContent: "center",
				backgroundImage: `linear-gradient(135deg, ${from}, ${to})`,
				border: `6px solid ${INK}`,
				color: ink,
				fontFamily: "Anton",
				fontSize: size * 0.5,
			}}
		>
			{content.handle.charAt(0).toUpperCase()}
		</div>
	)
}

export function ProfileCard({ content }: { content: OgProfileContent }) {
	const posters = content.posters
		.filter((src): src is string => Boolean(src))
		.slice(0, 6)
	const grid = posters.length >= 2
	const name = `@${content.handle}`
	return (
		<Frame>
			<div style={{ position: "absolute", top: 44, left: 56, display: "flex" }}>
				<Brand dark />
			</div>
			<div
				style={col({
					position: "absolute",
					left: 56,
					bottom: 52,
					width: PANEL_LEFT - 100,
					gap: 18,
				})}
			>
				{/* Without posters the picture fills the dark panel instead. */}
				<div style={row({ alignItems: "center", gap: 22 })}>
					{grid && <Avatar content={content} size={112} />}
					<Tag text="Profile" />
				</div>
				<div
					style={{
						display: "flex",
						fontFamily: "Anton",
						fontSize: fitFontSize(name, [
							[9, 120],
							[12, 96],
							[16, 76],
							[20, 62],
							[25, 50],
							[999, 42],
						]),
						lineHeight: 1,
						color: INK,
					}}
				>
					{name}
				</div>
				{content.persona && (
					<div
						style={{
							display: "flex",
							fontSize: 34,
							fontWeight: 800,
							color: INK,
							opacity: 0.85,
						}}
					>
						{content.persona}
					</div>
				)}
				{content.stats.length > 0 && (
					<div style={row({ gap: 40, marginTop: 6 })}>
						{content.stats.map((stat) => (
							<div key={stat.label} style={col({ gap: 2 })}>
								<div
									style={{
										display: "flex",
										fontFamily: "Anton",
										fontSize: 56,
										lineHeight: 1,
										color: INK,
									}}
								>
									{stat.value}
								</div>
								<div
									style={{
										display: "flex",
										fontSize: 22,
										fontWeight: 900,
										letterSpacing: 2,
										color: INK,
										opacity: 0.75,
									}}
								>
									{stat.label.toUpperCase()}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
			<div
				style={col({
					position: "absolute",
					top: 0,
					left: PANEL_LEFT,
					width: 1200 - PANEL_LEFT,
					height: 630,
					backgroundColor: INK,
					alignItems: "center",
					justifyContent: "center",
				})}
			>
				{grid ? (
					<div
						style={row({
							flexWrap: "wrap",
							width: POSTER_W * 3 + GAP * 2,
							gap: GAP,
						})}
					>
						{posters.map((src, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: a fixed grid of posters
								key={i}
								style={{
									display: "flex",
									position: "relative",
									width: POSTER_W,
									height: POSTER_H,
									borderRadius: 10,
									overflow: "hidden",
									backgroundColor: "#27272a",
								}}
							>
								<Picture
									src={src}
									alignTop
									style={{ top: 0, left: 0, width: POSTER_W, height: POSTER_H }}
								/>
							</div>
						))}
					</div>
				) : (
					<Avatar content={content} size={260} />
				)}
			</div>
		</Frame>
	)
}
