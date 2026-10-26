// The cards of the "New on your services" pages (/new), in one layout: the headline on amber at the left, big
// service tiles running off the right edge.
// - A service in a country (/new/de/netflix): a huge logo, the country's flag in a disc on its corner.
// - A country (/new/de): a huge flag, the logos of the services with arrivals along its foot.
// - The member's own page (/new): a wall of service logos, a few ticked as the viewer's own, the rest stepped back.
// - The share link (/new/netflix), which sends each viewer to their own country: the huge logo, a disc of four flags.
// Image fields hold data URIs when rendered (og-image.server.tsx inlines the logos; flags are read as data URIs).
import type { ReactNode } from "react"
import {
	AMBER,
	Brand,
	Frame,
	INK,
	Subtext,
	Tag,
	col,
	fitFontSize,
	headlineText,
	row,
} from "~/ui/og-image/parts"

export interface OgNewServicesLogo {
	name: string
	logo: string | null
	/** On the member card's wall: one of the viewer's own services. */
	picked?: boolean
}

export interface OgNewServicesContent {
	kind: "new-services"
	layout: "service" | "country" | "member" | "share"
	tag: string | null
	headline: string
	tally: string | null
	/** The country's flag (service and country cards). */
	flag: string | null
	/** The share card's disc. */
	flags: string[]
	brand: OgNewServicesLogo | null
	/** The country card's services, or the member card's wall. */
	logos: OgNewServicesLogo[]
}

const at = (style: React.CSSProperties) =>
	({ position: "absolute", display: "flex", ...style }) as const

/** A service's app icon on an ink rim. */
function LogoTile({
	logo,
	size,
	rim,
}: { logo: OgNewServicesLogo; size: number; rim: number }) {
	const radius = Math.round(size * 0.22)
	const inner = size - rim * 2
	return (
		<div
			style={{
				display: "flex",
				width: size,
				height: size,
				borderRadius: radius,
				backgroundColor: INK,
				padding: rim,
			}}
		>
			{logo.logo ? (
				<img
					alt=""
					src={logo.logo}
					style={{ width: inner, height: inner, borderRadius: radius - rim }}
				/>
			) : (
				<div
					style={{
						display: "flex",
						width: inner,
						height: inner,
						borderRadius: radius - rim,
						backgroundColor: "#262626",
						color: "#fff",
						fontSize: Math.round(size / 7),
						fontWeight: 900,
						textAlign: "center",
						alignItems: "center",
						justifyContent: "center",
						padding: Math.round(size / 12),
					}}
				>
					{logo.name}
				</div>
			)}
		</div>
	)
}

/** A disc on an ink rim; the content fills it. */
function Disc({ size, children }: { size: number; children: ReactNode }) {
	const rim = Math.round(size / 22)
	const inner = size - rim * 2
	return (
		<div
			style={{
				display: "flex",
				width: size,
				height: size,
				borderRadius: size / 2,
				backgroundColor: INK,
				padding: rim,
			}}
		>
			<div
				style={{
					display: "flex",
					flexWrap: "wrap",
					width: inner,
					height: inner,
					borderRadius: inner / 2,
					overflow: "hidden",
					backgroundColor: INK,
				}}
			>
				{children}
			</div>
		</div>
	)
}

function FlagDisc({ flag, size }: { flag: string | null; size: number }) {
	const inner = size - Math.round(size / 22) * 2
	return (
		<Disc size={size}>
			{flag && (
				<img
					alt=""
					src={flag}
					style={{ width: inner, height: inner, objectFit: "cover" }}
				/>
			)}
		</Disc>
	)
}

/** Four flags in the quarters of a disc. */
function FlagMosaic({ flags, size }: { flags: string[]; size: number }) {
	const half = (size - Math.round(size / 22) * 2) / 2
	return (
		<Disc size={size}>
			{flags.slice(0, 4).map((flag, i) => (
				<img
					key={String(i)}
					alt=""
					src={flag}
					style={{ width: half, height: half, objectFit: "cover" }}
				/>
			))}
		</Disc>
	)
}

/** A 3:2 flag on an ink rim. */
function FlagTile({ flag, width }: { flag: string | null; width: number }) {
	const rim = 14
	const radius = 36
	const height = Math.round((width * 2) / 3)
	return (
		<div
			style={{
				display: "flex",
				width,
				height,
				borderRadius: radius,
				backgroundColor: INK,
				padding: rim,
			}}
		>
			{flag && (
				<img
					alt=""
					src={flag}
					style={{
						width: width - rim * 2,
						height: height - rim * 2,
						borderRadius: radius - rim,
						objectFit: "cover",
					}}
				/>
			)}
		</div>
	)
}

function Tick() {
	return (
		<div
			style={at({
				right: -8,
				top: -8,
				width: 52,
				height: 52,
				borderRadius: 26,
				backgroundColor: INK,
				border: `4px solid ${AMBER}`,
				alignItems: "center",
				justifyContent: "center",
			})}
		>
			<svg width="28" height="28" viewBox="0 0 24 24">
				<path
					d="M4 12.5l5 5L20 6.5"
					fill="none"
					stroke={AMBER}
					strokeWidth="4"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		</div>
	)
}

// The member card's wall: three columns that fit the card, the last row running off its foot.
function LogoWall({ logos }: { logos: OgNewServicesLogo[] }) {
	const size = 168
	const gap = 20
	return (
		<div
			style={at({
				top: 0,
				left: 650,
				width: 600,
				height: 630,
				flexWrap: "wrap",
				gap,
				paddingTop: 24,
			})}
		>
			{logos.map((logo, i) => (
				<div
					key={`${logo.name}-${String(i)}`}
					style={{
						display: "flex",
						position: "relative",
						opacity: logo.picked ? 1 : 0.32,
					}}
				>
					<LogoTile logo={logo} size={size} rim={logo.picked ? 9 : 6} />
					{logo.picked && <Tick />}
				</div>
			))}
		</div>
	)
}

export function NewServicesCard({
	content,
}: { content: OgNewServicesContent }) {
	const { layout, brand } = content
	return (
		<Frame>
			{(layout === "service" || layout === "share") && brand && (
				<div style={at({ top: 70, left: 700 })}>
					<LogoTile logo={brand} size={560} rim={14} />
				</div>
			)}
			{layout === "service" && (
				<div style={at({ top: 376, left: 610 })}>
					<FlagDisc flag={content.flag} size={210} />
				</div>
			)}
			{layout === "share" && (
				<div style={at({ top: 290, left: 596 })}>
					<FlagMosaic flags={content.flags} size={310} />
				</div>
			)}
			{layout === "country" && (
				<>
					<div style={at({ top: 60, left: 640 })}>
						<FlagTile flag={content.flag} width={620} />
					</div>
					<div style={at({ top: 430, left: 600, ...row({ gap: 10 }) })}>
						{content.logos.slice(0, 5).map((logo) => (
							<LogoTile key={logo.name} logo={logo} size={104} rim={6} />
						))}
					</div>
				</>
			)}
			{layout === "member" && <LogoWall logos={content.logos} />}
			<div style={at({ top: 44, left: 56 })}>
				<Brand dark />
			</div>
			<div
				style={at({ left: 56, bottom: 52, width: 560, ...col({ gap: 16 }) })}
			>
				{content.tag && <Tag text={content.tag} />}
				<div
					style={{
						display: "flex",
						fontFamily: "Anton",
						fontSize: fitFontSize(content.headline, [
							[8, 150],
							[12, 120],
							[18, 96],
							[999, 76],
						]),
						lineHeight: 0.95,
						letterSpacing: 1,
						color: INK,
					}}
				>
					{headlineText(content.headline)}
				</div>
				<Subtext text={content.tally} />
			</div>
		</Frame>
	)
}
