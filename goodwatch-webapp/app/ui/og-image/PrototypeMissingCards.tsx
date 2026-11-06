// PROTOTYPE (throwaway, branch prototype/missing-og): link-preview card variants for pages that share another page's
// card today: blog posts, By your tropes, Hot on socials. Rendered by scripts/prototype-missing-og/render.tsx; nothing
// in the app imports this file. The A-D keys repeat per page type. Variants marked `live` are not drawn here: the
// gallery shows the card production serves today for the page they reuse.
import type { ReactNode } from "react"
import { OgCard } from "~/ui/og-image/OgCard"
import {
	AMBER,
	Brand,
	Frame,
	HEIGHT,
	Headline,
	INK,
	SUBTEXT_HEIGHT,
	Subtext,
	TAG_HEIGHT,
	TEXT_TOP,
	Tag,
	col,
	row,
	showsSubtext,
} from "~/ui/og-image/parts"

export type MissingPageType = "blog" | "tropes" | "hot" | "taste" | "explore"

export interface MissingPoster {
	src: string | null
	title: string
}

export interface MissingEntry {
	label: string
	poster: MissingPoster
	/** Daily reads for the Hot sparkline, oldest first. */
	curve?: number[]
}

export interface MissingCardContent {
	type: MissingPageType
	tag: string
	headline: string
	subtitle: string
	backdrop: string | null
	/** The poster a card leads with. */
	hero: MissingPoster
	/** Posters for grids, deduplicated. */
	wall: MissingPoster[]
	/** Labelled posters: ranks on Hot, trope names on By your tropes. */
	entries: MissingEntry[]
	/** Trope rows: a trope and the titles that have it. */
	groups: { label: string; posters: MissingPoster[] }[]
}

export interface Variant {
	key: string
	name: string
	/** Not drawn: the gallery shows production's card for this canonical path. */
	live?: string
}

export const VARIANTS: Record<MissingPageType, Variant[]> = {
	blog: [
		{ key: "A", name: "Band split: backdrop of the first title the post names, amber band with kind, headline and dek" },
		{ key: "B", name: "Title-forward amber: no picture, kind tag, the headline as big as it fits, dek under it" },
		{ key: "C", name: "Posters from the post: amber headline left, the first four titles it names in a 2x2 grid on ink" },
		{ key: "D", name: "Mirror split: the first named title's backdrop left, amber panel with kind, headline and dek right" },
	],
	tropes: [
		{ key: "A", name: "Reuse the For you card as is (/watch/for-you)", live: "/watch/for-you" },
		{ key: "B", name: "Band split: a top title's backdrop, amber band with For you tag and By your tropes" },
		{ key: "C", name: "Trope ledger: amber headline left, ink panel with three example tropes and four titles each" },
		{ key: "D", name: "Labelled row: headline across the top, five posters each named by one trope it has" },
	],
	hot: [
		{ key: "A", name: "Band split: the top title's backdrop, amber band with the headline" },
		{ key: "B", name: "Ranked row: headline across the top, the top five posters with #1 to #5 in Anton under each" },
		{ key: "C", name: "Ledger: amber headline left, ink list of the top five with rank, title and its spike" },
		{ key: "D", name: "Number one: poster split for the top title, its name as the headline under a #1 tag" },
	],
	taste: [{ key: "A", name: "What previews show today: the page redirects to /taste, so the /taste card", live: "/taste" }],
	explore: [{ key: "A", name: "What previews show today: the page 301s to its collection page, whose card shows", live: "" }],
}

const SLATE = "#151b1c"

function Poster({ poster, width }: { poster: MissingPoster | undefined; width: number }) {
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
				<img alt="" src={poster.src} width={width} height={height} style={{ objectFit: "cover" }} />
			)}
		</div>
	)
}

const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`)

const Line = ({
	text,
	size,
	weight = 700,
	color = "#fff",
	max,
	font = "Gabarito",
}: { text: string; size: number; weight?: number; color?: string; max: number; font?: string }) => (
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

// A title's daily reads as a line, scaled to its own peak: the spike at the right is the point.
function Spark({ curve, width, height }: { curve: number[]; width: number; height: number }) {
	const peak = Math.max(...curve, 1)
	const step = width / Math.max(curve.length - 1, 1)
	const points = curve
		.map((v, i) => `${(i * step).toFixed(1)},${(height - 3 - (v / peak) * (height - 6)).toFixed(1)}`)
		.join(" ")
	return (
		// biome-ignore lint/a11y/noSvgWithoutTitle: drawn into a card image
		<svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
			<polyline points={points} fill="none" stroke={AMBER} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
		</svg>
	)
}

// --- Layouts --------------------------------------------------------------------------------------------------------

const bandCard = (c: MissingCardContent) => (
	<OgCard content={{ kind: "page", tag: c.tag, title: c.headline, subtitle: c.subtitle, backdrop: c.backdrop }} />
)

const mirrorCard = (c: MissingCardContent) => (
	<OgCard
		content={{ kind: "collection", tag: c.tag, title: c.headline, subtitle: c.subtitle, backdrop: c.backdrop, providerId: null }}
	/>
)

const posterCard = (c: MissingCardContent, tag: string, title: string) => (
	<OgCard content={{ kind: "title", tag, title, score: null, poster: c.hero.src }} />
)

// All amber, no picture: brand top left, then tag, headline and dek at the bottom.
function AmberCard({ c }: { c: MissingCardContent }) {
	const sub = showsSubtext(c.subtitle)
	return (
		<Frame>
			<div style={{ position: "absolute", top: 44, left: 56, display: "flex" }}>
				<Brand dark />
			</div>
			<div style={col({ position: "absolute", left: 56, top: TEXT_TOP, bottom: 52, width: 1088, gap: 18, justifyContent: "flex-end" })}>
				<Tag text={c.tag} />
				<Headline
					text={c.headline}
					width={1088}
					height={HEIGHT - TEXT_TOP - 52 - TAG_HEIGHT - 18 - (sub ? SUBTEXT_HEIGHT + 18 : 0)}
					max={150}
				/>
				<Subtext text={c.subtitle} />
			</div>
		</Frame>
	)
}

// Amber headline column left; an ink panel at the right holds whatever the card lists.
function LeftHeadline({ c, width, children }: { c: MissingCardContent; width: number; children: ReactNode }) {
	return (
		<Frame>
			<div style={{ position: "absolute", top: 44, left: 56, display: "flex" }}>
				<Brand dark />
			</div>
			<div style={col({ position: "absolute", left: 56, top: 150, bottom: 52, width, gap: 18, justifyContent: "flex-end" })}>
				<Tag text={c.tag} />
				<Headline text={c.headline} width={width} height={HEIGHT - 150 - 52 - TAG_HEIGHT - 18} max={130} />
			</div>
			{children}
		</Frame>
	)
}

function GridCard({ c }: { c: MissingCardContent }) {
	const posters = c.wall.slice(0, 4)
	const width = 190
	return (
		<LeftHeadline c={c} width={520}>
			<div
				style={{
					display: "flex",
					flexWrap: "wrap",
					position: "absolute",
					top: 0,
					left: 640,
					width: 560,
					height: HEIGHT,
					backgroundColor: INK,
					padding: "22px 82px",
					gap: 16,
				}}
			>
				{posters.map((p) => (
					<Poster key={p.title} poster={p} width={width} />
				))}
			</div>
		</LeftHeadline>
	)
}

function TropeLedgerCard({ c }: { c: MissingCardContent }) {
	return (
		<LeftHeadline c={c} width={440}>
			<div
				style={col({
					position: "absolute",
					top: 0,
					left: 556,
					width: 644,
					height: HEIGHT,
					backgroundColor: INK,
					padding: "22px 48px",
					justifyContent: "space-between",
				})}
			>
				{c.groups.slice(0, 3).map((g) => (
					<div key={g.label} style={col({ gap: 8 })}>
						<Line text={g.label.toUpperCase()} size={24} weight={900} color={AMBER} max={30} />
						<div style={row({ gap: 14 })}>
							{g.posters.slice(0, 4).map((p) => (
								<Poster key={p.title} poster={p} width={104} />
							))}
						</div>
					</div>
				))}
			</div>
		</LeftHeadline>
	)
}

function HotLedgerCard({ c }: { c: MissingCardContent }) {
	const entries = c.entries.slice(0, 5)
	const rowHeight = Math.floor((HEIGHT - 2 * 44) / entries.length)
	return (
		<LeftHeadline c={c} width={440}>
			<div
				style={col({
					position: "absolute",
					top: 0,
					left: 556,
					width: 644,
					height: HEIGHT,
					backgroundColor: INK,
					padding: "44px 48px",
					justifyContent: "center",
				})}
			>
				{entries.map((e) => (
					<div key={e.label} style={row({ height: rowHeight, alignItems: "center", gap: 22 })}>
						<div style={{ display: "flex", width: 70, fontFamily: "Anton", fontSize: 54, color: AMBER, lineHeight: 1 }}>
							{e.label}
						</div>
						{/* Long titles wrap to a second line rather than lose their end. */}
						<div
							style={{
								display: "flex",
								width: 320,
								maxHeight: 70,
								overflow: "hidden",
								fontSize: e.poster.title.length > 18 ? 28 : 34,
								fontWeight: 700,
								lineHeight: 1.1,
								color: "#fff",
							}}
						>
							{clip(e.poster.title, 40)}
						</div>
						{e.curve && <Spark curve={e.curve} width={112} height={48} />}
					</div>
				))}
			</div>
		</LeftHeadline>
	)
}

// Headline across the top; a row of posters below, each with a label under it.
function RowCard({ c, labels }: { c: MissingCardContent; labels: "rank" | "name" }) {
	const count = 5
	const width = 184
	const entries = c.entries.slice(0, count)
	return (
		<Frame>
			<div style={{ position: "absolute", top: 44, right: 56, display: "flex" }}>
				<Brand dark />
			</div>
			<div style={col({ position: "absolute", top: 44, left: 56, width: 700 })}>
				<Tag text={c.tag} />
			</div>
			<div style={{ position: "absolute", top: 120, left: 56, display: "flex" }}>
				<Headline text={c.headline} width={1088} height={130} max={124} min={60} />
			</div>
			<div style={row({ position: "absolute", left: 56, top: labels === "rank" ? 262 : 268, width: 1088, gap: Math.floor((1088 - count * width) / (count - 1)) })}>
				{entries.map((e) => (
					<div key={e.label + e.poster.title} style={col({ width, gap: 6 })}>
						<Poster poster={e.poster} width={width} />
						{labels === "rank" ? (
							<Line text={e.label} size={48} font="Anton" weight={400} color={INK} max={4} />
						) : (
							<Line text={e.label} size={24} weight={900} color={INK} max={15} />
						)}
					</div>
				))}
			</div>
		</Frame>
	)
}

export function PrototypeMissingCard({ variant, content: c }: { variant: string; content: MissingCardContent }) {
	switch (`${c.type}-${variant}`) {
		case "blog-A":
			return bandCard(c)
		case "blog-B":
			return <AmberCard c={c} />
		case "blog-C":
			return <GridCard c={{ ...c, subtitle: "" }} />
		case "blog-D":
			return mirrorCard(c)
		case "tropes-B":
			return bandCard(c)
		case "tropes-C":
			return <TropeLedgerCard c={c} />
		case "tropes-D":
			return <RowCard c={{ ...c, headline: "Picks by your tropes" }} labels="name" />
		case "hot-A":
			return bandCard({ ...c, tag: "Hot on socials", headline: "What everyone's talking about" })
		case "hot-B":
			return <RowCard c={c} labels="rank" />
		case "hot-C":
			return <HotLedgerCard c={c} />
		case "hot-D":
			return posterCard(c, "#1 on socials", c.hero.title)
		default:
			throw new Error(`no layout for ${c.type}-${variant}`)
	}
}
