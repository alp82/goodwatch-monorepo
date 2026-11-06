import { AWARDS_CARD_COPY as COPY } from "~/ui/og-image/copy"
// The cards of the awards pages (/awards) that the title card's poster split doesn't draw:
// - The hub (/awards) and a category (/awards/<body>/category/<slug>): the tag and headline across the top, a row of
//   winners' posters below, each named under it. The hub names the body, a category the ceremony year. A short row
//   keeps the posters' size and sits in the middle.
// - A ceremony (/awards/<body>/<year>): the body's tag, the year as a giant number with "Winners" under it, and the
//   top winner's poster on the right, where the title card has its poster.
// A body's page and a category with one winner use the title card (OgCard.tsx). Image fields hold data URIs when
// rendered (og-image.server.tsx inlines them).
import {
	Brand,
	Frame,
	HEIGHT,
	Headline,
	INK,
	Picture,
	TEXT_TOP,
	Tag,
	col,
	row,
} from "~/ui/og-image/parts"

export interface OgAwardPoster {
	src: string | null
	/** The body's name on the hub, the ceremony year on a category. */
	label: string
}

export type OgAwardsContent =
	| {
			kind: "awards"
			layout: "row"
			labels: "name" | "year"
			tag: string
			headline: string
			posters: OgAwardPoster[]
	  }
	| {
			kind: "awards"
			layout: "year"
			tag: string
			year: number
			poster: string | null
	  }

const SIDE = 56
const ROW_WIDTH = 1200 - 2 * SIDE
const POSTER_SLATE = "#151b1c"

// A row of five names or six years (ROW_YEARS in server/og-image/awards-content.server.ts) fills the card's width;
// the gap stays the same when there are fewer.
const ROWS = {
	name: { max: 5, width: 184 },
	year: { max: 6, width: 160 },
} as const

function Poster({ src, width }: { src: string | null; width: number }) {
	const height = Math.round(width * 1.5)
	return (
		<div
			style={{
				display: "flex",
				width,
				height,
				borderRadius: Math.round(width / 16),
				backgroundColor: POSTER_SLATE,
				overflow: "hidden",
			}}
		>
			{src && (
				<img
					alt=""
					src={src}
					width={width}
					height={height}
					style={{ objectFit: "cover" }}
				/>
			)}
		</div>
	)
}

// One line under a poster, cut with an ellipsis rather than wrapped.
function Label({
	text,
	width,
	years,
}: { text: string; width: number; years: boolean }) {
	return (
		<div
			style={{
				display: "flex",
				width,
				color: INK,
				whiteSpace: "nowrap",
				overflow: "hidden",
				textOverflow: "ellipsis",
				lineHeight: 1.1,
				...(years
					? { fontFamily: "Anton", fontSize: 44, letterSpacing: 1 }
					: { fontSize: 26, fontWeight: 900 }),
			}}
		>
			{text}
		</div>
	)
}

function RowCard({
	content,
}: { content: Extract<OgAwardsContent, { layout: "row" }> }) {
	const { max, width } = ROWS[content.labels]
	const gap = Math.floor((ROW_WIDTH - max * width) / (max - 1))
	return (
		<Frame>
			<div
				style={{ position: "absolute", top: 44, right: SIDE, display: "flex" }}
			>
				<Brand dark />
			</div>
			<div
				style={{ position: "absolute", top: 44, left: SIDE, display: "flex" }}
			>
				<Tag text={content.tag} />
			</div>
			<div
				style={{ position: "absolute", top: 124, left: SIDE, display: "flex" }}
			>
				<Headline
					text={content.headline}
					width={ROW_WIDTH}
					height={146}
					max={130}
				/>
			</div>
			<div
				style={row({
					position: "absolute",
					left: SIDE,
					top: 290,
					width: ROW_WIDTH,
					gap,
					justifyContent: "center",
				})}
			>
				{content.posters.slice(0, max).map((poster, i) => (
					<div
						key={`${poster.label}-${String(i)}`}
						style={col({ width, gap: 6 })}
					>
						<Poster src={poster.src} width={width} />
						<Label
							text={poster.label}
							width={width}
							years={content.labels === "year"}
						/>
					</div>
				))}
			</div>
		</Frame>
	)
}

function YearCard({
	content,
}: { content: Extract<OgAwardsContent, { layout: "year" }> }) {
	return (
		<Frame>
			<Picture
				src={content.poster}
				alignTop
				style={{ top: 0, left: 780, width: 420, height: HEIGHT }}
			/>
			<div
				style={{ position: "absolute", top: 44, left: SIDE, display: "flex" }}
			>
				<Brand dark />
			</div>
			<div
				style={col({
					position: "absolute",
					left: SIDE,
					top: TEXT_TOP,
					bottom: 44,
					width: 670,
					justifyContent: "flex-end",
				})}
			>
				<Tag text={content.tag} />
				<div
					style={{
						display: "flex",
						marginTop: 4,
						fontFamily: "Anton",
						fontSize: 300,
						lineHeight: 1,
						letterSpacing: 2,
						color: INK,
					}}
				>
					{String(content.year)}
				</div>
				<div
					style={{
						display: "flex",
						fontFamily: "Anton",
						fontSize: 64,
						lineHeight: 1,
						letterSpacing: 1,
						color: INK,
					}}
				>
					{COPY.yearLine.toUpperCase()}
				</div>
			</div>
		</Frame>
	)
}

export function AwardsCard({ content }: { content: OgAwardsContent }) {
	return content.layout === "year" ? (
		<YearCard content={content} />
	) : (
		<RowCard content={content} />
	)
}
