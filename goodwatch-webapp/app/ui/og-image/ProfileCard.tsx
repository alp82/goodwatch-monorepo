import { PROFILE_CARD_COPY } from "~/ui/og-image/copy"
// The member profile cards. Both open with a compact amber band: picture, @handle (and the tab's name), the logo.
// - /u/<handle>: the taste fingerprint on the right, its strongest pulls named on the left with leader lines that go
//   round the outside of the print, and a teaser to open the profile. Without a public taste: favorites' posters.
// - /u/<handle>/<tab>: one visual per tab (score spread, posters, show progress, lists, taste groups) and one line.
// Satori: flex only, every multi-child element needs display:flex, no text inside <svg>, overlay <svg>s need a viewBox.
import {
	AMBER,
	Brand,
	Frame,
	INK,
	col,
	fitFontSize,
	row,
	vibeColor,
} from "~/ui/og-image/parts"
import type {
	CardAttribute,
	CardPerson,
	OgProfileContent,
	OgProfileTabContent,
	ProfileTabVisual,
} from "~/ui/og-image/profile-card-model"
import { build } from "~/ui/profile/taste/Whorl"
import { FAMILY_COLOR } from "~/ui/profile/taste/model"

export type { OgProfileContent, OgProfileTabContent }

const HEADER_H = 128
const MUTED = "#a1a1aa"

function Avatar({ person, size }: { person: CardPerson; size: number }) {
	const [from, to, ink] = person.avatarColors
	const border = `${Math.max(3, Math.round(size / 22))}px solid ${INK}`
	return person.avatar ? (
		<img
			alt=""
			src={person.avatar}
			width={size}
			height={size}
			style={{
				width: size,
				height: size,
				borderRadius: size,
				objectFit: "cover",
				objectPosition: "center top",
				border,
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
				border,
				color: ink,
				fontFamily: "Anton",
				fontSize: size * 0.5,
			}}
		>
			{person.handle.charAt(0).toUpperCase()}
		</div>
	)
}

// Anton sets about 0.48 em per character; the handle shrinks to fit its room.
const handleSize = (handle: string, room: number) =>
	Math.min(
		fitFontSize(`@${handle}`, [
			[12, 64],
			[18, 54],
			[999, 44],
		]),
		Math.floor(room / ((handle.length + 1) * 0.48)),
	)

function Header({ person, tab }: { person: CardPerson; tab?: string }) {
	return (
		<div
			style={row({
				position: "absolute",
				left: 0,
				top: 0,
				width: 1200,
				height: HEADER_H,
				backgroundColor: AMBER,
				alignItems: "center",
				justifyContent: "space-between",
				padding: "0 44px",
			})}
		>
			<div style={row({ alignItems: "center", gap: 18 })}>
				<Avatar person={person} size={86} />
				<div
					style={{
						display: "flex",
						fontFamily: "Anton",
						fontSize: handleSize(person.handle, tab ? 420 : 680),
						lineHeight: 1,
						color: INK,
					}}
				>
					{`@${person.handle}`}
				</div>
				{tab && (
					<div style={row({ alignItems: "center", gap: 14 })}>
						<div
							style={{
								display: "flex",
								fontFamily: "Anton",
								fontSize: 56,
								color: INK,
								opacity: 0.35,
							}}
						>
							/
						</div>
						<div
							style={{
								display: "flex",
								fontFamily: "Anton",
								fontSize: 58,
								lineHeight: 1,
								color: INK,
							}}
						>
							{tab.toUpperCase()}
						</div>
					</div>
				)}
			</div>
			<Brand dark size={44} />
		</div>
	)
}

/** The print's geometry scaled to `size` card pixels. */
function printGeometry(
	attributes: CardAttribute[],
	size: number,
	rim: boolean,
	turns = 18,
) {
	const g = build(attributes, turns, rim)
	const b = g.box
	const s = size / (2 * b)
	return {
		g,
		b,
		px: (x: number, y: number) => ({ x: (x + b) * s, y: (y + b + 10) * s }),
	}
}

function Print({
	attributes,
	size,
	labels = false,
}: { attributes: CardAttribute[]; size: number; labels?: boolean }) {
	const { g, b, px } = printGeometry(attributes, size, true)
	return (
		<div
			style={{
				display: "flex",
				position: "relative",
				width: size,
				height: size,
			}}
		>
			{/* biome-ignore lint/a11y/noSvgWithoutTitle: drawn into a card image; the image's alt text comes from the page meta */}
			<svg
				width={size}
				height={size}
				viewBox={`${-b} ${-b - 10} ${b * 2} ${b * 2}`}
			>
				{g.turns.flatMap((turn, i) =>
					turn.paths.map((p, j) => (
						<path
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed geometry
							key={`${i}-${j}`}
							d={p.d}
							fill="none"
							stroke={FAMILY_COLOR[p.family]}
							strokeOpacity={p.opacity}
							strokeWidth={2.5}
							strokeLinecap="round"
						/>
					)),
				)}
				{g.markers.map((m) => (
					<circle
						key={m.a.key}
						cx={m.x}
						cy={m.y}
						r={m.r}
						fill={m.a.edge > 0 ? FAMILY_COLOR[m.a.family] : "none"}
						stroke={FAMILY_COLOR[m.a.family]}
						strokeWidth={m.a.edge > 0 ? 0 : 1.2}
					/>
				))}
			</svg>
			{labels &&
				g.labels.map((l) => {
					const p = px(l.x, l.y)
					return (
						<div
							key={l.id}
							style={{
								display: "flex",
								position: "absolute",
								left: p.x - 70,
								top: p.y - 9,
								width: 140,
								justifyContent: "center",
								fontSize: 15,
								fontWeight: 900,
								letterSpacing: 2,
								color: FAMILY_COLOR[l.id],
							}}
						>
							{l.id.toUpperCase()}
						</div>
					)
				})}
		</div>
	)
}

const Kicker = ({ text }: { text: string }) => (
	<div
		style={{
			display: "flex",
			fontSize: 20,
			fontWeight: 900,
			letterSpacing: 3,
			color: AMBER,
		}}
	>
		{text.toUpperCase()}
	</div>
)

function Poster({ src, w, h }: { src: string | null; w: number; h: number }) {
	return (
		<div
			style={{
				display: "flex",
				position: "relative",
				width: w,
				height: h,
				borderRadius: 10,
				overflow: "hidden",
				backgroundColor: "#27272a",
			}}
		>
			{src && (
				<img
					alt=""
					src={src}
					width={w}
					height={h}
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						width: w,
						height: h,
						objectFit: "cover",
					}}
				/>
			)}
		</div>
	)
}

/** Posters filling a row: the tallest that fit the height, one more column if that leaves a gap, sized to the width. */
function PosterRow({
	posters,
	w,
	h,
	gap = 14,
}: { posters: (string | null)[]; w: number; h: number; gap?: number }) {
	const shown = posters.filter((p): p is string => Boolean(p))
	const per = Math.min(
		shown.length,
		Math.max(1, Math.ceil((w + gap) / (Math.round(h / 1.5) + gap))),
	)
	const pw = Math.min(
		Math.round(h / 1.5),
		Math.floor((w - gap * (per - 1)) / per),
	)
	return (
		<div style={row({ width: w, gap })}>
			{shown.slice(0, per).map((src, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: a fixed row
				<Poster key={i} src={src} w={pw} h={Math.round(pw * 1.5)} />
			))}
		</div>
	)
}

/** An arrow drawn as a path: the fonts have no arrow glyph. */
const Arrow = ({ color, size }: { color: string; size: number }) => (
	// biome-ignore lint/a11y/noSvgWithoutTitle: drawn into a card image; the image's alt text comes from the page meta
	<svg width={size} height={size} viewBox="0 0 24 24">
		<path
			d="M4 12 H19 M13 6 L19 12 L13 18"
			fill="none"
			stroke={color}
			strokeWidth={3}
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
)

// ---------- /u/<handle> ----------

const BODY_TOP = HEADER_H
const BODY_H = 630 - HEADER_H
const RING_STEP = 9
// Where the teaser pill starts (it sits 40 px above the bottom edge).
const TEASER_TOP = 630 - 40 - 52

/** The picks' leader lines: each goes from its dot out to a ring round the print, along the ring, then to its label. */
function leaders(print: CardAttribute[], picks: CardAttribute[]) {
	// The largest print whose outermost ring still fits the body.
	let size = 500
	let geo = printGeometry(print, size, true)
	let ring = 0
	for (; size > 300; size -= 10) {
		geo = printGeometry(print, size, true)
		const pts = geo.g.markers.map((m) => geo.px(m.x, m.y))
		const ys = pts.map((q) => q.y)
		ring = (Math.max(...ys) - Math.min(...ys)) / 2 + 16
		if (ring + RING_STEP * (picks.length - 1) <= BODY_H / 2 - 6) break
	}
	const left = 1200 - 64 - size
	const top = BODY_TOP + (BODY_H - size) / 2
	const pts = geo.g.markers.map((m) => geo.px(m.x, m.y))
	const cx =
		left +
		(Math.min(...pts.map((q) => q.x)) + Math.max(...pts.map((q) => q.x))) / 2
	const cy =
		top +
		(Math.min(...pts.map((q) => q.y)) + Math.max(...pts.map((q) => q.y))) / 2
	// Angles are taken in mirrored space (labels sit on the left), so sorting by angle orders the dots top to bottom
	// going round the far side, and the label slots follow that order.
	const flip = (x: number) => 2 * cx - x
	const dots = picks
		.map((a) => {
			const m = geo.g.markers.find((x) => x.a.key === a.key)
			const p = m ? geo.px(m.x, m.y) : { x: size / 2, y: size / 2 }
			const x = p.x + left
			const y = p.y + top
			return { a, x, y, theta: Math.atan2(y - cy, flip(x) - cx) }
		})
		.sort((p, q) => p.theta - q.theta)
	const labelX = left - 64
	// Label slots centred on the print, kept between the band and the teaser.
	const step = 78
	const span = step * (dots.length - 1)
	const first = Math.max(
		BODY_TOP + 30,
		Math.min(TEASER_TOP - 70 - span, cy - 22 - span / 2),
	)
	// Longer trips round the print take outer rings, so no line crosses another's dot.
	const byTravel = [...dots].sort(
		(p, q) => Math.abs(p.theta) - Math.abs(q.theta),
	)
	const placed = dots.map((d, i) => {
		const ly = first + i * step
		const r = ring + byTravel.indexOf(d) * RING_STEP
		const phi = Math.asin(Math.max(-0.9, Math.min(0.9, (ly + 22 - cy) / r)))
		const parts = [`M${d.x.toFixed(1)} ${d.y.toFixed(1)}`]
		for (let k = 0; k <= 28; k++) {
			const t = d.theta + ((phi - d.theta) * k) / 28
			parts.push(
				`L${flip(cx + r * Math.cos(t)).toFixed(1)} ${(cy + r * Math.sin(t)).toFixed(1)}`,
			)
		}
		parts.push(`L${labelX + 6} ${ly + 22}`)
		return { ...d, ly, path: parts.join(" ") }
	})
	return { size, left, top, labelX, placed }
}

function FingerprintBody({
	print,
	picks,
}: { print: CardAttribute[]; picks: CardAttribute[] }) {
	const { size, left, top, labelX, placed } = leaders(print, picks)
	return (
		<div
			style={{
				display: "flex",
				position: "absolute",
				left: 0,
				top: 0,
				width: 1200,
				height: 630,
			}}
		>
			<div style={{ display: "flex", position: "absolute", left, top }}>
				<Print attributes={print} size={size} />
			</div>
			{/* biome-ignore lint/a11y/noSvgWithoutTitle: drawn into a card image; the image's alt text comes from the page meta */}
			<svg
				width={1200}
				height={630}
				viewBox="0 0 1200 630"
				style={{ position: "absolute", left: 0, top: 0 }}
			>
				{placed.map((p) => (
					<path
						key={`h-${p.a.key}`}
						d={p.path}
						fill="none"
						stroke={INK}
						strokeOpacity={0.85}
						strokeWidth={7}
						strokeLinejoin="round"
					/>
				))}
				{placed.map((p) => (
					<path
						key={`l-${p.a.key}`}
						d={p.path}
						fill="none"
						stroke="#ffffff"
						strokeOpacity={0.75}
						strokeWidth={2}
						strokeLinejoin="round"
					/>
				))}
				{placed.map((p) => (
					<circle
						key={`c-${p.a.key}`}
						cx={p.x}
						cy={p.y}
						r={7}
						fill={INK}
						stroke="#ffffff"
						strokeWidth={2.5}
					/>
				))}
			</svg>
			{placed.map((p) => (
				<div
					key={`t-${p.a.key}`}
					style={{
						display: "flex",
						position: "absolute",
						top: p.ly,
						right: 1200 - labelX,
						width: 560,
						justifyContent: "flex-end",
						fontFamily: "Anton",
						fontSize: fitFontSize(p.a.label.toUpperCase(), [
							[16, 44],
							[22, 36],
							[999, 30],
						]),
						lineHeight: 1.05,
						color: FAMILY_COLOR[p.a.family],
					}}
				>
					{p.a.label.toUpperCase()}
				</div>
			))}
		</div>
	)
}

function Teaser() {
	return (
		<div style={row({ position: "absolute", left: 44, bottom: 40 })}>
			<div
				style={row({
					alignItems: "center",
					gap: 12,
					border: `2px solid ${AMBER}`,
					borderRadius: 40,
					padding: "10px 22px",
					color: AMBER,
					fontSize: 26,
					fontWeight: 900,
				})}
			>
				<div style={{ display: "flex" }}>{PROFILE_CARD_COPY.teaser}</div>
				<Arrow color={AMBER} size={26} />
			</div>
		</div>
	)
}

export function ProfileCard({ content }: { content: OgProfileContent }) {
	const posters = content.posters.filter((p): p is string => Boolean(p))
	return (
		<Frame bg={INK}>
			<Header person={content} />
			{content.print && content.picks.length ? (
				<FingerprintBody print={content.print} picks={content.picks} />
			) : posters.length ? (
				<div
					style={{
						display: "flex",
						position: "absolute",
						left: 44,
						top: BODY_TOP + 44,
					}}
				>
					<PosterRow posters={posters} w={1112} h={300} />
				</div>
			) : (
				<div
					style={{
						display: "flex",
						position: "absolute",
						right: 120,
						top: BODY_TOP + 60,
					}}
				>
					<Avatar person={content} size={330} />
				</div>
			)}
			<Teaser />
		</Frame>
	)
}

// ---------- /u/<handle>/<tab> ----------

const VIS_W = 1088
const VIS_H = 630 - HEADER_H - 36 - 84

const SCORE_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function Spread({
	spread,
	width,
	height,
}: { spread: number[]; width: number; height: number }) {
	const max = Math.max(...spread, 1)
	const gap = 8
	const bw = Math.floor((width - gap * 9) / 10)
	return (
		<div style={col({ width, gap: 6 })}>
			<div style={row({ width, height, alignItems: "flex-end", gap })}>
				{SCORE_STEPS.map((score) => (
					<div
						key={score}
						style={{
							display: "flex",
							width: bw,
							height: Math.max(
								3,
								Math.round(((spread[score - 1] ?? 0) / max) * height),
							),
							borderRadius: 4,
							backgroundColor: vibeColor(score * 10 - 1),
						}}
					/>
				))}
			</div>
			<div style={row({ width, gap })}>
				{SCORE_STEPS.map((score) => (
					<div
						key={score}
						style={{
							display: "flex",
							width: bw,
							justifyContent: "center",
							fontSize: 18,
							fontWeight: 700,
							color: MUTED,
						}}
					>
						{String(score)}
					</div>
				))}
			</div>
		</div>
	)
}

function SplitBar({
	parts,
	width,
}: { parts: { name: string; share: number; color: string }[]; width: number }) {
	const shown = parts.filter((p) => p.share > 0.005)
	return (
		<div style={col({ width, gap: 10 })}>
			<div
				style={row({ width, height: 16, borderRadius: 16, overflow: "hidden" })}
			>
				{shown.map((p) => (
					<div
						key={p.name}
						style={{
							display: "flex",
							width: Math.max(6, Math.round(p.share * width)),
							height: 16,
							backgroundColor: p.color,
						}}
					/>
				))}
			</div>
			<div style={row({ gap: 22 })}>
				{shown.map((p) => (
					<div
						key={p.name}
						style={row({
							alignItems: "center",
							gap: 8,
							fontSize: 20,
							fontWeight: 700,
							color: "#d4d4d8",
						})}
					>
						<div
							style={{
								display: "flex",
								width: 12,
								height: 12,
								borderRadius: 12,
								backgroundColor: p.color,
							}}
						/>
						<div
							style={{ display: "flex" }}
						>{`${p.name} ${Math.round(p.share * 100)}%`}</div>
					</div>
				))}
			</div>
		</div>
	)
}

function TabVisual({ visual }: { visual: ProfileTabVisual }) {
	const w = VIS_W
	const h = VIS_H
	switch (visual.type) {
		case "scores":
			return (
				<div
					style={row({ width: w, height: h, gap: 40, alignItems: "center" })}
				>
					<Spread spread={visual.spread} width={520} height={h - 60} />
					{visual.posters.some(Boolean) && (
						<div style={col({ gap: 12 })}>
							<Kicker text={PROFILE_CARD_COPY.topScores} />
							<PosterRow posters={visual.posters} w={w - 560} h={h - 50} />
						</div>
					)}
				</div>
			)
		case "posters":
			return (
				<div
					style={col({
						width: w,
						height: h,
						gap: 18,
						justifyContent: "center",
					})}
				>
					{visual.kicker && <Kicker text={visual.kicker} />}
					<PosterRow
						posters={visual.posters}
						w={w}
						h={h - (visual.kicker ? 40 : 0) - (visual.split ? 70 : 0)}
					/>
					{visual.split && <SplitBar parts={visual.split} width={w} />}
				</div>
			)
		case "shows": {
			const n = Math.min(6, visual.shows.length)
			const gap = 16
			const pw = Math.min(
				Math.floor((w - gap * 5) / 6),
				Math.round((h - 24) / 1.5),
			)
			return (
				<div style={row({ width: w, height: h, gap, alignItems: "center" })}>
					{visual.shows.slice(0, n).map((s, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: a fixed row
						<div key={i} style={col({ width: pw, gap: 10 })}>
							<Poster src={s.poster} w={pw} h={Math.round(pw * 1.5)} />
							<div
								style={row({
									width: pw,
									height: 10,
									borderRadius: 10,
									backgroundColor: "rgba(255,255,255,0.15)",
									overflow: "hidden",
								})}
							>
								<div
									style={{
										display: "flex",
										width: Math.max(6, Math.round(s.progress * pw)),
										height: 10,
										backgroundColor: AMBER,
									}}
								/>
							</div>
						</div>
					))}
				</div>
			)
		}
		case "lists": {
			const lists = visual.lists.slice(0, 2)
			const cw = lists.length > 1 ? Math.floor((w - 48) / 2) : w
			const per = lists.length > 1 ? 3 : 5
			return (
				<div
					style={row({ width: w, height: h, gap: 48, alignItems: "center" })}
				>
					{lists.map((l, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: at most two
						<div key={i} style={col({ width: cw, gap: 12 })}>
							<div
								style={{
									display: "flex",
									fontSize: 28,
									fontWeight: 900,
									color: "#fff",
								}}
							>
								{l.title}
							</div>
							<PosterRow
								posters={l.posters.slice(0, per)}
								w={cw}
								h={Math.min(
									h - 60,
									Math.round(((cw - 14 * (per - 1)) / per) * 1.5),
								)}
							/>
						</div>
					))}
				</div>
			)
		}
		case "taste": {
			const top = Math.max(...visual.groups.map((g) => g.size), 1)
			const gw = w - 440
			const barW = gw - (visual.groups.some((g) => g.average != null) ? 90 : 0)
			return (
				<div
					style={row({ width: w, height: h, gap: 40, alignItems: "center" })}
				>
					<Print attributes={visual.print} size={Math.min(400, h)} labels />
					<div style={col({ width: gw, gap: 12 })}>
						<Kicker text={PROFILE_CARD_COPY.tasteGroups} />
						{visual.groups.slice(0, 5).map((g) => (
							<div key={g.name} style={col({ gap: 6 })}>
								<div
									style={{
										display: "flex",
										fontSize: 22,
										fontWeight: 900,
										color: "#fff",
									}}
								>
									{g.name}
								</div>
								<div style={row({ alignItems: "center", gap: 14 })}>
									<div
										style={row({
											width: barW,
											height: 12,
											borderRadius: 12,
											backgroundColor: "rgba(255,255,255,0.08)",
										})}
									>
										<div
											style={{
												display: "flex",
												width: Math.round((g.size / top) * barW),
												height: 12,
												borderRadius: 12,
												backgroundColor: AMBER,
											}}
										/>
									</div>
									{g.average != null && (
										<div
											style={{
												display: "flex",
												padding: "2px 10px",
												borderRadius: 8,
												backgroundColor: vibeColor(g.average * 10),
												fontSize: 20,
												fontWeight: 900,
												color: "#fff",
											}}
										>
											{g.average.toFixed(1)}
										</div>
									)}
								</div>
							</div>
						))}
					</div>
				</div>
			)
		}
	}
}

export function ProfileTabCard({ content }: { content: OgProfileTabContent }) {
	return (
		<Frame bg={INK}>
			<Header person={content} tab={content.title} />
			<div
				style={{
					display: "flex",
					position: "absolute",
					left: 56,
					top: HEADER_H + 36,
				}}
			>
				<TabVisual visual={content.visual} />
			</div>
			<div
				style={{
					display: "flex",
					position: "absolute",
					left: 56,
					bottom: 30,
					fontSize: 26,
					fontWeight: 700,
					color: MUTED,
				}}
			>
				{content.line}
			</div>
		</Frame>
	)
}
