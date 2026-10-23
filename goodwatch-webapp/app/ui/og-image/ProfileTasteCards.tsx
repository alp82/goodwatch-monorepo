// Cards for two sections of a member's Taste tab, in the profile card family (amber band, ink body). Both stay readable
// at 400 px wide, a Discord embed: no text under 28 px.
// - /u/<handle>/taste/everyone: one or two titles they score far from everyone, each on a 1 to 10 line with their
//   score (a star) and everyone's (a ring), in points out of 10.
// - /u/<handle>/taste/sides: "Loves X, and just as much Y", the two taste groups least alike, three posters each.
// Satori: flex only, every multi-child element needs display:flex, no text inside <svg>.
import {
	HEADER_H,
	Header,
	MUTED,
	ONE_LINE,
	Poster,
	clip,
} from "~/ui/og-image/ProfileCard"
import { PROFILE_CARD_COPY } from "~/ui/og-image/copy"
import { AMBER, Frame, INK, col, row } from "~/ui/og-image/parts"
import {
	type CardSide,
	type EveryoneTake,
	type OgProfileEveryoneContent,
	type OgProfileSidesContent,
	labelCenters,
} from "~/ui/og-image/profile-card-model"
import { FAMILY_COLOR } from "~/ui/profile/taste/model"

const UP = "#34d399"
const DOWN = "#fb7185"
const EVERYONE = "#e4e4e7"

/** A five-point star drawn as a path: the fonts have no star glyph. */
const Star = ({ size }: { size: number }) => (
	// biome-ignore lint/a11y/noSvgWithoutTitle: drawn into a card image; the image's alt text comes from the page meta
	<svg width={size} height={size} viewBox="0 0 24 24">
		<path
			d="M12 1.8l3 6.3 6.9.8-5.1 4.8 1.4 6.8L12 17.3l-6.2 3.4 1.4-6.8L2.1 8.9l6.9-.8z"
			fill={AMBER}
			stroke={INK}
			strokeWidth={1.2}
			strokeLinejoin="round"
		/>
	</svg>
)

const Ring = ({ size }: { size: number }) => (
	<div
		style={{
			display: "flex",
			width: size,
			height: size,
			borderRadius: size,
			border: `${Math.round(size * 0.22)}px solid ${EVERYONE}`,
			backgroundColor: INK,
		}}
	/>
)

// ---------- /u/<handle>/taste/everyone ----------

const LEFT = 56
const POSTER_W = 120
const POSTER_H = 180
const RAIL_LEFT = LEFT + POSTER_W + 36
const RAIL_BOX = 1200 - LEFT - RAIL_LEFT
/** The 1 to 10 line inside the box, inset so a marker at either end stays inside. */
const TRACK_INSET = 40
const TRACK_W = RAIL_BOX - TRACK_INSET * 2
const TRACK_Y = 142
const NUMBER_SIZE = 52
const LABEL_W = 110
const STAR = 70
const RING = 52

const at = (score: number) => TRACK_INSET + ((score - 1) / 9) * TRACK_W

const ScoreNumber = ({
	value,
	center,
	color,
}: { value: string; center: number; color: string }) => (
	<div
		style={{
			display: "flex",
			position: "absolute",
			left: Math.round(center - LABEL_W / 2),
			top: 56,
			width: LABEL_W,
			justifyContent: "center",
			fontFamily: "Anton",
			fontSize: NUMBER_SIZE,
			lineHeight: 1,
			color,
		}}
	>
		{value}
	</div>
)

function Take({ take, top }: { take: EveryoneTake; top: number }) {
	const mine = at(take.mine)
	const everyone = at(take.everyone)
	const [a, b] = [Math.min(mine, everyone), Math.max(mine, everyone)]
	const [mineLabel, everyoneLabel] = labelCenters(
		mine,
		everyone,
		LABEL_W,
		RAIL_BOX,
	)
	return (
		<div
			style={row({
				position: "absolute",
				left: LEFT,
				top,
				width: 1200 - LEFT * 2,
				height: POSTER_H,
				gap: 36,
			})}
		>
			<Poster src={take.poster} w={POSTER_W} h={POSTER_H} />
			<div
				style={{
					display: "flex",
					position: "relative",
					width: RAIL_BOX,
					height: POSTER_H,
				}}
			>
				<div
					style={{
						...ONE_LINE,
						position: "absolute",
						left: 0,
						top: 0,
						width: RAIL_BOX,
						fontSize: 44,
						fontWeight: 900,
						lineHeight: 1.1,
						color: "#fff",
					}}
				>
					{clip(take.title, 34)}
				</div>
				{/* the 1 to 10 line */}
				<div
					style={{
						display: "flex",
						position: "absolute",
						left: TRACK_INSET,
						top: TRACK_Y - 8,
						width: TRACK_W,
						height: 16,
						borderRadius: 16,
						backgroundColor: "rgba(255,255,255,0.14)",
					}}
				/>
				{/* the gap between the two scores */}
				<div
					style={{
						display: "flex",
						position: "absolute",
						left: Math.round(a),
						top: TRACK_Y - 15,
						width: Math.max(8, Math.round(b - a)),
						height: 30,
						borderRadius: 30,
						backgroundColor: take.mine >= take.everyone ? UP : DOWN,
					}}
				/>
				<div
					style={{
						display: "flex",
						position: "absolute",
						left: Math.round(everyone - RING / 2),
						top: TRACK_Y - RING / 2,
					}}
				>
					<Ring size={RING} />
				</div>
				<div
					style={{
						display: "flex",
						position: "absolute",
						left: Math.round(mine - STAR / 2),
						top: TRACK_Y - STAR / 2 - 2,
					}}
				>
					<Star size={STAR} />
				</div>
				<ScoreNumber
					value={take.everyone.toFixed(1)}
					center={everyoneLabel}
					color={EVERYONE}
				/>
				<ScoreNumber
					value={String(take.mine)}
					center={mineLabel}
					color={AMBER}
				/>
			</div>
		</div>
	)
}

export function ProfileEveryoneCard({
	content,
}: { content: OgProfileEveryoneContent }) {
	const takes = content.takes.slice(0, 2)
	// One title sits in the middle of the body.
	const tops = takes.length > 1 ? [210, 420] : [300]
	return (
		<Frame bg={INK}>
			<Header person={content} tab={PROFILE_CARD_COPY.views.everyone} />
			<div
				style={row({
					position: "absolute",
					left: LEFT,
					top: HEADER_H + 26,
					alignItems: "center",
					gap: 36,
				})}
			>
				<div style={row({ alignItems: "center", gap: 12 })}>
					<Star size={40} />
					<div
						style={{
							display: "flex",
							fontSize: 32,
							fontWeight: 900,
							color: AMBER,
						}}
					>
						{PROFILE_CARD_COPY.theirScore}
					</div>
				</div>
				<div style={row({ alignItems: "center", gap: 12 })}>
					<Ring size={30} />
					<div
						style={{
							display: "flex",
							fontSize: 32,
							fontWeight: 900,
							color: EVERYONE,
						}}
					>
						{PROFILE_CARD_COPY.everyoneScore}
					</div>
				</div>
			</div>
			{takes.map((t, i) => (
				<Take key={t.title} take={t} top={tops[i]} />
			))}
		</Frame>
	)
}

// ---------- /u/<handle>/taste/sides ----------

const HALF_W = 520
const SIDE_POSTER_W = 150

function Half({
	side,
	kicker,
	align,
}: { side: CardSide; kicker: string; align: "left" | "right" }) {
	const edge = align === "left" ? "flex-start" : "flex-end"
	return (
		<div style={col({ width: HALF_W, gap: 16, alignItems: edge })}>
			<div
				style={{
					display: "flex",
					fontSize: 28,
					fontWeight: 900,
					letterSpacing: 2.5,
					color: MUTED,
				}}
			>
				{kicker.toUpperCase()}
			</div>
			<div
				style={{
					display: "flex",
					width: HALF_W,
					justifyContent: edge,
					textAlign: align,
					fontFamily: "Anton",
					fontSize: side.name.length > 24 ? 50 : 58,
					lineHeight: 1.04,
					color: FAMILY_COLOR[side.family] ?? AMBER,
				}}
			>
				{side.name.toUpperCase()}
			</div>
			<div style={row({ gap: 12, marginTop: 8 })}>
				{side.posters.map((p, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: a fixed row
					<Poster key={i} src={p} w={SIDE_POSTER_W} h={SIDE_POSTER_W * 1.5} />
				))}
			</div>
		</div>
	)
}

export function ProfileSidesCard({
	content,
}: { content: OgProfileSidesContent }) {
	return (
		<Frame bg={INK}>
			<Header person={content} tab={PROFILE_CARD_COPY.views.sides} />
			<div
				style={row({
					position: "absolute",
					left: LEFT,
					top: HEADER_H + 34,
					width: 1200 - LEFT * 2,
					justifyContent: "space-between",
				})}
			>
				<Half
					side={content.first}
					kicker={PROFILE_CARD_COPY.loves}
					align="left"
				/>
				<Half
					side={content.second}
					kicker={PROFILE_CARD_COPY.justAsMuch}
					align="right"
				/>
			</div>
			<div
				style={{
					display: "flex",
					position: "absolute",
					left: 599,
					top: HEADER_H + 40,
					width: 2,
					height: 630 - HEADER_H - 80,
					backgroundColor: "rgba(255,255,255,0.15)",
				}}
			/>
		</Frame>
	)
}
