// PROTOTYPE (throwaway, branch prototype/awards-og): link-preview card variants for the /awards pages.
// Rendered by scripts/prototype-awards-og/render.tsx; nothing in the app imports this file.
// The A-D keys repeat per page type: hub, body, year (one ceremony), category (one category across years).
import { OgCard } from "~/ui/og-image/OgCard"
import {
	AMBER,
	Brand,
	Frame,
	HEIGHT,
	Headline,
	INK,
	TAG_HEIGHT,
	Tag,
	WIDTH,
	col,
	row,
} from "~/ui/og-image/parts"

export type AwardPageType = "hub" | "body" | "year" | "category"

export interface AwardPoster {
	src: string | null
	title: string
}

/** One labelled poster: a year ("2026"), a body ("Oscars"), or a category ("Best Picture"), and its winner. */
export interface AwardEntry {
	label: string
	/** The ledger's label when it differs, such as "Oscars 2026" on the hub. */
	ledger?: string
	poster: AwardPoster
}

export interface AwardCardContent {
	type: AwardPageType
	/** The short label above the headline, such as "Academy Awards" or "Oscars". */
	tag: string
	/** The headline, such as "Oscars winners", "Oscars 2026", or "Best Picture". */
	headline: string
	/** The body's short name, for the year card's tag. */
	bodyName: string
	year: number | null
	/** The winner the card leads with: the headline category's latest winner. */
	hero: AwardPoster & { backdrop: string | null; label: string }
	/** Winner posters for walls, deduplicated. */
	wall: AwardPoster[]
	/** Labelled winners for rows and ledgers: years for body and category pages, bodies for the hub, categories for a year. */
	entries: AwardEntry[]
}

const SLATE = "#151b1c"

export const VARIANTS: Record<
	AwardPageType,
	{ key: string; name: string }[]
> = {
	hub: [
		{ key: "A", name: "Band split: latest Oscars winner's backdrop, amber band with the headline" },
		{ key: "B", name: "Row of bodies: each award body's latest headline winner, its name below" },
		{ key: "C", name: "Mirror split: wall of recent winners left, trophy glyph and headline right" },
		{ key: "D", name: "Ledger: amber headline left, ink list of body + year and its winner right" },
	],
	body: [
		{ key: "A", name: "Poster split: latest headline winner's poster, official name tag, body headline" },
		{ key: "B", name: "Band split: latest headline winner's backdrop, amber band with the headline" },
		{ key: "C", name: "Year row: the headline category's last six winners, year in Anton under each" },
		{ key: "D", name: "Mirror split: wall of latest winners left, trophy glyph and headline right" },
	],
	year: [
		{ key: "A", name: "Huge year: body tag, the year as a giant Anton number, headline winner's poster" },
		{ key: "B", name: "Band split: headline winner's backdrop, amber band with body + year" },
		{ key: "C", name: "Hero + winners: headline, the top category's winner big with three more winners" },
		{ key: "D", name: "Ledger: amber headline left, ink list of category and its winner right" },
	],
	category: [
		{ key: "A", name: "Poster split: latest winner's poster, body tag, category headline" },
		{ key: "B", name: "Year row: the last six winners, year in Anton under each" },
		{ key: "C", name: "Band split: latest winner's backdrop, amber band with the category" },
		{ key: "D", name: "Ledger: amber headline left, ink list of year and its winner right" },
	],
}

// The trophy of the awards pages' Won mark (heroicons 24 solid TrophyIcon), as inline SVG.
const TROPHY =
	"M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 0 0-.584.859 6.753 6.753 0 0 0 6.138 5.6 6.73 6.73 0 0 0 2.743 1.346A6.707 6.707 0 0 1 9.279 15H8.54c-1.036 0-1.875.84-1.875 1.875V19.5h-.75a2.25 2.25 0 0 0-2.25 2.25c0 .414.336.75.75.75h15a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-2.25-2.25h-.75v-2.625c0-1.036-.84-1.875-1.875-1.875h-.739a6.706 6.706 0 0 1-1.112-3.173 6.73 6.73 0 0 0 2.743-1.347 6.753 6.753 0 0 0 6.139-5.6.75.75 0 0 0-.585-.858 47.077 47.077 0 0 0-3.07-.543V2.62a.75.75 0 0 0-.658-.744 49.22 49.22 0 0 0-6.093-.377c-2.063 0-4.096.128-6.093.377a.75.75 0 0 0-.657.744Zm0 2.629c0 1.196.312 2.32.857 3.294A5.266 5.266 0 0 1 3.16 5.337a45.6 45.6 0 0 1 2.006-.343v.256Zm13.5 0v-.256c.674.1 1.343.214 2.006.343a5.265 5.265 0 0 1-2.863 3.207 6.72 6.72 0 0 0 .857-3.294Z"

const Trophy = ({ size, color = INK }: { size: number; color?: string }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
		<path fillRule="evenodd" clipRule="evenodd" d={TROPHY} />
	</svg>
)

function Poster({
	poster,
	width,
}: { poster: AwardPoster | undefined; width: number }) {
	const height = Math.round(width * 1.5)
	return (
		<div
			style={{
				display: "flex",
				position: "relative",
				width,
				height,
				borderRadius: Math.round(width / 16),
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

const clip = (text: string, max: number) =>
	text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`

// One line of text that never wraps; longer text is cut with an ellipsis.
const Line = ({
	text,
	size,
	weight = 700,
	color = "#fff",
	max,
	font = "Gabarito",
}: {
	text: string
	size: number
	weight?: number
	color?: string
	max: number
	font?: string
}) => (
	<div
		style={{
			display: "flex",
			fontFamily: font,
			fontSize: size,
			fontWeight: weight,
			color,
			whiteSpace: "nowrap",
			overflow: "hidden",
			lineHeight: 1.1,
		}}
	>
		{clip(text, max)}
	</div>
)

// --- Shared layouts -------------------------------------------------------------------------------------------------

const bandCard = (c: AwardCardContent) => (
	<OgCard
		content={{
			kind: "page",
			tag: c.tag,
			title: c.headline,
			subtitle: "",
			backdrop: c.hero.backdrop,
		}}
	/>
)

const posterCard = (c: AwardCardContent) => (
	<OgCard
		content={{
			kind: "title",
			tag: c.tag,
			title: c.headline,
			score: null,
			poster: c.hero.src,
		}}
	/>
)

// Amber card: tag and headline across the top, brand at the top right, a row of six labelled posters below.
function RowCard({
	c,
	labelFont,
}: { c: AwardCardContent; labelFont: "year" | "name" }) {
	// A body page whose headline category has few years falls back to the latest winners, unlabelled.
	const few = c.type === "body" && c.entries.length < 4
	const count = labelFont === "name" ? 5 : 6
	const entries = few
		? c.wall.slice(0, count).map((poster) => ({ label: "", poster }))
		: c.entries.slice(0, count)
	const width = count === 5 ? 184 : 160
	return (
		<Frame>
			<div style={{ position: "absolute", top: 44, right: 56, display: "flex" }}>
				<Brand dark />
			</div>
			<div style={col({ position: "absolute", top: 44, left: 56, width: 700, gap: 12 })}>
				<Tag text={c.tag} />
			</div>
			<div style={{ position: "absolute", top: 124, left: 56, display: "flex" }}>
				<Headline text={c.headline} width={1088} height={146} max={130} min={60} />
			</div>
			<div
				style={row({
					position: "absolute",
					left: 56,
					top: 290,
					width: 1088,
					gap: Math.floor((1088 - count * width) / (count - 1)),
				})}
			>
				{entries.map((e) => (
					<div key={e.label + e.poster.title} style={col({ width, gap: 6, alignItems: "flex-start" })}>
						<Poster poster={e.poster} width={width} />
						{few ? null : labelFont === "year" ? (
							<Line text={e.label} size={44} font="Anton" weight={400} color={INK} max={6} />
						) : (
							<Line text={e.label} size={26} weight={900} color={INK} max={14} />
						)}
					</div>
				))}
			</div>
		</Frame>
	)
}

// Three staggered columns of posters on ink, running off the top and bottom (DiscoveryCard's wall, mirrored left).
function WallCard({ c }: { c: AwardCardContent }) {
	const width = 160
	const offsets = [-110, -20, -160]
	const posters = c.wall.length ? c.wall : [c.hero]
	return (
		<Frame>
			<div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: 560, height: HEIGHT, backgroundColor: INK, overflow: "hidden" }}>
				<div style={row({ position: "absolute", left: 20, top: 0, gap: 16 })}>
					{offsets.map((offset, column) => (
						<div key={offset} style={col({ marginTop: offset, gap: 16 })}>
							{[0, 1, 2, 3].map((r) => (
								<Poster key={r} poster={posters[(r * 3 + column) % posters.length]} width={width} />
							))}
						</div>
					))}
				</div>
			</div>
			<div style={{ position: "absolute", top: 44, left: 616, display: "flex" }}>
				<Brand dark />
			</div>
			<div style={col({ position: "absolute", left: 616, top: 130, bottom: 52, width: 528, gap: 18, justifyContent: "flex-end" })}>
				<Trophy size={110} />
				<Tag text={c.tag} />
				<Headline text={c.headline} width={528} height={HEIGHT - 130 - 52 - 110 - 18 - TAG_HEIGHT - 18} max={140} />
			</div>
		</Frame>
	)
}

// Amber left with the headline; ink right with a list: label in amber, winner in white.
function LedgerCard({ c, labelStyle }: { c: AwardCardContent; labelStyle: "year" | "small" }) {
	const count = labelStyle === "year" ? 6 : 5
	const entries = c.entries.slice(0, count)
	const rowHeight = Math.floor((HEIGHT - 2 * 44) / count)
	return (
		<Frame>
			<div style={{ position: "absolute", top: 44, left: 56, display: "flex" }}>
				<Brand dark />
			</div>
			<div style={col({ position: "absolute", left: 56, top: 150, bottom: 52, width: 440, gap: 18, justifyContent: "flex-end" })}>
				<Tag text={c.tag} />
				<Headline text={c.headline} width={440} height={HEIGHT - 150 - 52 - TAG_HEIGHT - 18} max={130} />
			</div>
			<div style={col({ position: "absolute", top: 0, left: 556, width: 644, height: HEIGHT, backgroundColor: INK, padding: "44px 48px", justifyContent: "center" })}>
				{entries.map((e) =>
					labelStyle === "year" ? (
						<div key={e.label} style={row({ height: rowHeight, alignItems: "center", gap: 28 })}>
							<div style={{ display: "flex", width: 110, fontFamily: "Anton", fontSize: 54, color: AMBER, lineHeight: 1 }}>{e.label}</div>
							<Line text={e.poster.title} size={e.poster.title.length > 24 ? 28 : 34} max={e.poster.title.length > 24 ? 27 : 24} />
						</div>
					) : (
						<div key={e.label} style={col({ height: rowHeight, justifyContent: "center", gap: 4 })}>
							<Line text={(e.ledger ?? e.label).toUpperCase()} size={24} weight={900} color={AMBER} max={34} />
							<Line text={e.poster.title} size={36} max={28} />
						</div>
					),
				)}
			</div>
		</Frame>
	)
}

// --- Type-specific layouts ------------------------------------------------------------------------------------------

// The year as a giant number under the body's tag, the headline winner's poster at the right.
function HugeYearCard({ c }: { c: AwardCardContent }) {
	return (
		<Frame>
			<img alt="" src={c.hero.src ?? ""} style={{ position: "absolute", top: 0, left: 780, width: 420, height: 630, objectFit: "cover", objectPosition: "center top" }} />
			<div style={{ position: "absolute", top: 44, left: 56, display: "flex" }}>
				<Brand dark />
			</div>
			<div style={col({ position: "absolute", left: 56, top: 130, bottom: 44, width: 670, justifyContent: "flex-end" })}>
				<Tag text={c.bodyName} />
				<div style={{ display: "flex", fontFamily: "Anton", fontSize: 300, lineHeight: 1, color: INK, marginTop: 4, letterSpacing: 2 }}>
					{String(c.year)}
				</div>
				<div style={{ display: "flex", fontFamily: "Anton", fontSize: 64, lineHeight: 1, color: INK, letterSpacing: 1 }}>
					WINNERS
				</div>
			</div>
		</Frame>
	)
}

// Headline left; at the right the top category's winner big, three more winners in a column next to it.
function HeroCard({ c }: { c: AwardCardContent }) {
	const others = c.wall.filter((p) => p.title !== c.hero.title).slice(0, 3)
	return (
		<Frame>
			<div style={{ position: "absolute", top: 44, left: 56, display: "flex" }}>
				<Brand dark />
			</div>
			<div style={col({ position: "absolute", left: 56, top: 150, bottom: 52, width: 520, gap: 18, justifyContent: "flex-end" })}>
				<Tag text={c.tag} />
				<Headline text={c.headline} width={520} height={HEIGHT - 150 - 52 - TAG_HEIGHT - 18} max={150} />
			</div>
			<div style={row({ position: "absolute", top: 44, right: 56, gap: 16 })}>
				<div style={col({ gap: 10 })}>
					<Poster poster={c.hero} width={340} />
					{c.hero.label.length <= 24 && (
						<Line text={c.hero.label.toUpperCase()} size={24} weight={900} color={INK} max={24} />
					)}
				</div>
				<div style={col({ gap: 16 })}>
					{others.map((p) => (
						<Poster key={p.title} poster={p} width={110} />
					))}
				</div>
			</div>
		</Frame>
	)
}

export function PrototypeAwardCard({
	variant,
	content: c,
}: { variant: string; content: AwardCardContent }) {
	switch (`${c.type}-${variant}`) {
		case "hub-A":
			return bandCard(c)
		case "hub-B":
			return <RowCard c={c} labelFont="name" />
		case "hub-C":
			return <WallCard c={c} />
		case "hub-D":
			return <LedgerCard c={c} labelStyle="small" />
		case "body-A":
			return posterCard(c)
		case "body-B":
			return bandCard(c)
		case "body-C":
			return <RowCard c={c} labelFont="year" />
		case "body-D":
			return <WallCard c={c} />
		case "year-A":
			return <HugeYearCard c={c} />
		case "year-B":
			return bandCard(c)
		case "year-C":
			return <HeroCard c={c} />
		case "year-D":
			return <LedgerCard c={c} labelStyle="small" />
		case "category-A":
			return posterCard(c)
		case "category-B":
			return <RowCard c={c} labelFont="year" />
		case "category-C":
			return bandCard(c)
		default:
			return <LedgerCard c={c} labelStyle="year" />
	}
}

export { WIDTH }
