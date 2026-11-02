// Discover and Explorer cards: the pitch on the amber panel, real posters on a dark panel.
// Discover shows a search and the wall of posters that answers it; Explorer shows two islands
// and the bridge that forms between them.
import type { OgDiscoveryContent, OgPoster } from "~/ui/og-image/OgCard"
import { DISCOVERY_COPY } from "~/ui/og-image/copy"
import { AMBER, Brand, Frame, INK, Tag, col, row } from "~/ui/og-image/parts"

export type DiscoveryFeature = "explorer" | "discover"

const PANEL_LEFT = 560
const PANEL_WIDTH = 1200 - PANEL_LEFT
const SLATE = "#151b1c"

function Poster({
	poster,
	width,
}: { poster: OgPoster | undefined; width: number }) {
	const height = Math.round(width * 1.5)
	return (
		<div
			style={{
				display: "flex",
				position: "relative",
				width,
				height,
				borderRadius: width / 16,
				backgroundColor: SLATE,
				overflow: "hidden",
			}}
		>
			{poster?.src && (
				<img
					alt=""
					src={poster.src}
					width={width}
					height={height}
					style={{ objectFit: "cover" }}
				/>
			)}
		</div>
	)
}

// Three staggered columns of posters that run off the top and bottom of the panel.
function PosterWall({ posters }: { posters: OgPoster[] }) {
	const width = 170
	const offsets = [-120, -30, -170]
	return (
		<div style={row({ position: "absolute", left: 20, top: 0, gap: 16 })}>
			{offsets.map((offset, c) => (
				<div key={offset} style={col({ marginTop: offset, gap: 16 })}>
					{[0, 1, 2, 3].map((r) => (
						<Poster
							key={r}
							poster={posters[(r * 3 + c) % Math.max(posters.length, 1)]}
							width={width}
						/>
					))}
				</div>
			))}
		</div>
	)
}

// The search field, with the words as if just typed.
function SearchField({ text }: { text: string }) {
	return (
		<div
			style={row({
				alignItems: "center",
				gap: 18,
				width: 540,
				height: 96,
				padding: "0 30px",
				borderRadius: 16,
				backgroundColor: "#fff",
				border: `4px solid ${INK}`,
			})}
		>
			<svg
				aria-hidden="true"
				width="38"
				height="38"
				viewBox="0 0 24 24"
				fill="none"
			>
				<circle cx="10.5" cy="10.5" r="7" stroke={INK} strokeWidth="3" />
				<path
					d="M16 16 L22 22"
					stroke={INK}
					strokeWidth="3.4"
					strokeLinecap="round"
				/>
			</svg>
			<div
				style={{
					display: "flex",
					fontSize: 42,
					fontWeight: 700,
					color: INK,
					whiteSpace: "nowrap",
				}}
			>
				{text}
			</div>
			<div
				style={{
					display: "flex",
					width: 5,
					height: 46,
					marginLeft: -12,
					backgroundColor: INK,
				}}
			/>
		</div>
	)
}

function DiscoverCard({ posters }: { posters: OgPoster[] }) {
	const copy = DISCOVERY_COPY.discover
	const left = 620
	return (
		<Frame>
			<div
				style={{
					display: "flex",
					position: "absolute",
					left,
					top: 0,
					width: 1200 - left,
					height: 630,
					backgroundColor: INK,
					overflow: "hidden",
				}}
			>
				<PosterWall posters={posters} />
			</div>
			<div style={{ display: "flex", position: "absolute", left: 48, top: 40 }}>
				<Brand dark />
			</div>
			<div
				style={col({
					position: "absolute",
					left: 48,
					bottom: 48,
					width: 540,
					gap: 26,
				})}
			>
				<div
					style={col({
						fontFamily: "Anton",
						fontSize: 104,
						lineHeight: 1,
						color: INK,
						whiteSpace: "nowrap",
					})}
				>
					{copy.lines.map((line) => (
						<div key={line}>{line.toUpperCase()}</div>
					))}
				</div>
				<SearchField text={copy.search} />
			</div>
		</Frame>
	)
}

function Island({
	label,
	posters,
	x,
	y,
	width,
	bridge = false,
}: {
	label: string
	posters: OgPoster[]
	x: number
	y: number
	width: number
	bridge?: boolean
}) {
	return (
		<div
			style={col({
				position: "absolute",
				left: x,
				top: y,
				alignItems: "center",
				gap: 16,
				padding: 16,
				borderRadius: 26,
				backgroundColor: bridge ? "#2a2210" : SLATE,
				border: `3px solid ${bridge ? AMBER : "#2b3638"}`,
			})}
		>
			<div style={row({ gap: 8 })}>
				{posters.map((poster, i) => (
					<Poster key={i} poster={poster} width={width} />
				))}
			</div>
			<div
				style={{
					display: "flex",
					fontSize: bridge ? 28 : 24,
					fontWeight: 900,
					letterSpacing: 2,
					color: bridge ? AMBER : "#e7ece9",
				}}
			>
				{label.toUpperCase()}
			</div>
		</div>
	)
}

// A faint dot grid, so the panel reads as a map.
function MapGrid() {
	const dots = []
	for (let x = 16; x < PANEL_WIDTH; x += 32)
		for (let y = 16; y < 630; y += 32)
			dots.push(
				<circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="#243032" />,
			)
	return (
		<svg
			aria-hidden="true"
			width={PANEL_WIDTH}
			height="630"
			viewBox={`0 0 ${PANEL_WIDTH} 630`}
			style={{ position: "absolute", left: 0, top: 0 }}
		>
			{dots}
		</svg>
	)
}

function ExplorerMap({ groups }: { groups: OgDiscoveryContent["groups"] }) {
	const [left, right, bridge] = groups
	return (
		<>
			<MapGrid />
			<svg
				aria-hidden="true"
				width={PANEL_WIDTH}
				height="630"
				viewBox={`0 0 ${PANEL_WIDTH} 630`}
				style={{ position: "absolute", left: 0, top: 0 }}
			>
				<path
					d="M167 292 C167 318 250 310 262 332 M473 292 C473 318 390 310 378 332"
					fill="none"
					stroke={AMBER}
					strokeWidth="4"
					strokeDasharray="2 12"
					strokeLinecap="round"
				/>
			</svg>
			{left && <Island {...left} x={24} y={22} width={120} />}
			{right && <Island {...right} x={330} y={22} width={120} />}
			{bridge && <Island {...bridge} x={98} y={334} width={130} bridge />}
		</>
	)
}

export function DiscoveryCard({ content }: { content: OgDiscoveryContent }) {
	if (content.feature === "discover")
		return <DiscoverCard posters={content.groups[0]?.posters ?? []} />
	const copy = DISCOVERY_COPY.explorer
	return (
		<Frame>
			<div
				style={{
					display: "flex",
					position: "absolute",
					left: PANEL_LEFT,
					top: 0,
					width: PANEL_WIDTH,
					height: 630,
					backgroundColor: INK,
					overflow: "hidden",
				}}
			>
				<ExplorerMap groups={content.groups} />
			</div>
			<div style={{ display: "flex", position: "absolute", left: 56, top: 44 }}>
				<Brand dark />
			</div>
			<div
				style={col({
					position: "absolute",
					left: 56,
					bottom: 52,
					width: 470,
					gap: 20,
				})}
			>
				<Tag text={copy.tag} />
				<div
					style={col({
						fontFamily: "Anton",
						fontSize: 92,
						whiteSpace: "nowrap",
						lineHeight: 0.98,
						color: INK,
					})}
				>
					{copy.lines.map((line) => (
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
					{copy.subtitle}
				</div>
			</div>
		</Frame>
	)
}
