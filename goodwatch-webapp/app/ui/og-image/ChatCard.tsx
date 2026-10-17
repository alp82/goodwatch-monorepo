// The /use-with-ai card: the pitch on the amber panel, and on a dark panel the chat it describes. A casual prompt is
// answered with real top-scored posters from the streaming service it names, each with its GoodWatch score.
import type { OgPoster } from "~/ui/og-image/OgCard"
import { AI_CHAT_COPY } from "~/ui/og-image/copy"
import {
	Brand,
	Frame,
	INK,
	Tag,
	col,
	row,
	vibeColor,
} from "~/ui/og-image/parts"
import { goodwatchScoreDisplay } from "~/utils/ratings"

const PANEL_LEFT = 520
const PANEL_WIDTH = 1200 - PANEL_LEFT
const SLATE = "#151b1c"
const BUBBLE = "#3f3f46"
const MUTED = "#a1a1aa"
const POSTER_WIDTH = 160
const POSTER_HEIGHT = 240

// The score badge the connector's poster cards carry: a small "G" over the score, in the score's vibe color.
function ScoreBadge({ score }: { score: number }) {
	return (
		<div
			style={col({
				position: "absolute",
				top: -6,
				right: 10,
				width: 50,
				height: 62,
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: vibeColor(score),
				borderTopLeftRadius: 22,
				borderTopRightRadius: 22,
				borderBottomLeftRadius: 9,
				borderBottomRightRadius: 9,
				color: "#fff",
				fontWeight: 900,
				lineHeight: 1,
			})}
		>
			<div style={{ display: "flex", fontSize: 17, opacity: 0.9 }}>G</div>
			<div style={{ display: "flex", fontSize: 26 }}>
				{String(goodwatchScoreDisplay(score))}
			</div>
		</div>
	)
}

// A check in a circle, drawn because the card's fonts have no check mark.
function CheckMark() {
	return (
		<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24">
			<circle cx="12" cy="12" r="11" fill={MUTED} />
			<path
				d="M7 12.5l3.2 3.2L17 9"
				fill="none"
				stroke={INK}
				strokeWidth="2.6"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

function Poster({ poster }: { poster: OgPoster | undefined }) {
	return (
		<div
			style={{
				display: "flex",
				position: "relative",
				width: POSTER_WIDTH,
				height: POSTER_HEIGHT,
			}}
		>
			<div
				style={{
					display: "flex",
					width: POSTER_WIDTH,
					height: POSTER_HEIGHT,
					borderRadius: 12,
					backgroundColor: SLATE,
					overflow: "hidden",
				}}
			>
				{poster?.src && (
					<img
						alt=""
						src={poster.src}
						width={POSTER_WIDTH}
						height={POSTER_HEIGHT}
						style={{ objectFit: "cover" }}
					/>
				)}
			</div>
			{poster?.score != null && <ScoreBadge score={poster.score} />}
		</div>
	)
}

function Chat({ posters }: { posters: OgPoster[] }) {
	return (
		<div
			style={col({
				position: "absolute",
				left: PANEL_LEFT,
				top: 0,
				width: PANEL_WIDTH,
				height: 630,
				backgroundColor: INK,
				justifyContent: "center",
				padding: "0 44px 8px",
				gap: 26,
			})}
		>
			<div style={row({ justifyContent: "flex-end" })}>
				<div
					style={{
						display: "flex",
						backgroundColor: BUBBLE,
						color: "#fff",
						fontSize: 34,
						padding: "14px 26px 18px",
						borderTopLeftRadius: 30,
						borderTopRightRadius: 30,
						borderBottomLeftRadius: 30,
						borderBottomRightRadius: 8,
					}}
				>
					{AI_CHAT_COPY.prompt}
				</div>
			</div>
			<div style={row({ gap: 18, alignItems: "flex-start" })}>
				<div
					style={{
						display: "flex",
						flexShrink: 0,
						width: 48,
						height: 48,
						alignItems: "center",
						justifyContent: "center",
						borderRadius: 24,
						backgroundColor: BUBBLE,
						color: "#e4e4e7",
						fontSize: 18,
						fontWeight: 900,
					}}
				>
					AI
				</div>
				<div style={col({ gap: 22, paddingTop: 10 })}>
					<div
						style={row({
							alignItems: "center",
							gap: 10,
							fontSize: 24,
							color: MUTED,
						})}
					>
						<CheckMark />
						{AI_CHAT_COPY.toolLine}
					</div>
					<div style={row({ gap: 16, marginTop: 6 })}>
						{[0, 1, 2].map((i) => (
							<Poster key={i} poster={posters[i]} />
						))}
					</div>
					<div style={{ display: "flex", fontSize: 28, color: "#e4e4e7" }}>
						{AI_CHAT_COPY.reply}
					</div>
				</div>
			</div>
		</div>
	)
}

export function ChatCard({ posters }: { posters: OgPoster[] }) {
	return (
		<Frame>
			<Chat posters={posters} />
			<div style={{ display: "flex", position: "absolute", left: 56, top: 44 }}>
				<Brand dark />
			</div>
			<div
				style={col({
					position: "absolute",
					left: 56,
					bottom: 52,
					width: 430,
					gap: 20,
				})}
			>
				<Tag text={AI_CHAT_COPY.tag} />
				<div
					style={col({
						fontFamily: "Anton",
						fontSize: 72,
						whiteSpace: "nowrap",
						lineHeight: 0.98,
						color: INK,
					})}
				>
					{AI_CHAT_COPY.lines.map((line) => (
						<div key={line}>{line.toUpperCase()}</div>
					))}
				</div>
				<div
					style={{
						display: "flex",
						fontSize: 30,
						fontWeight: 700,
						lineHeight: 1.2,
						color: INK,
						opacity: 0.8,
					}}
				>
					{AI_CHAT_COPY.subtitle}
				</div>
			</div>
		</Frame>
	)
}
