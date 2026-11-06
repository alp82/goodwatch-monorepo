// The card of the Hot on socials page (/hot): the tag and headline on amber at the left, and on ink at the right the
// ranking's top five (server/og-image/hot-content.server.ts), each with its rank, its name and its daily reads as a
// line that ends in the spike.
import { HOT_CARD_COPY as COPY } from "~/ui/og-image/copy"
import {
	AMBER,
	Brand,
	Frame,
	HEIGHT,
	Headline,
	INK,
	TAG_HEIGHT,
	Tag,
	col,
	row,
} from "~/ui/og-image/parts"

export interface OgHotTitle {
	rank: number
	title: string
	/** Daily reads, oldest first; the last is the ranking's day. */
	curve: number[]
}

export interface OgHotContent {
	kind: "hot"
	titles: OgHotTitle[]
}

const SIDE = 56
const TEXT_WIDTH = 440
const TEXT_TOP = 150
const BOTTOM = 52
const PANEL_LEFT = 556
const PANEL_PAD_Y = 44
const PANEL_PAD_X = 48
const RANK_WIDTH = 76
const NAME_WIDTH = 314
const GAP = 22
const SPARK = { width: 112, height: 48 }
// Up to five rows share the panel's height.
const ROWS = 5
const ROW_HEIGHT = Math.floor((HEIGHT - 2 * PANEL_PAD_Y) / ROWS)
// A short name sets large; a long one wraps to three lines at most, and a longer one ends in an ellipsis.
const NAME_LARGE = { maxLength: 16, fontSize: 34 }
const NAME_SMALL = 28
const NAME_LINE_HEIGHT = 1.1
const NAME_MAX_LENGTH = 54

// A name past its length ends after its last whole word.
const clip = (text: string) => {
	if (text.length <= NAME_MAX_LENGTH) return text
	const cut = text.slice(0, NAME_MAX_LENGTH - 1)
	const space = cut.lastIndexOf(" ")
	return `${(space > 0 ? cut.slice(0, space) : cut).replace(/[\s,:;–-]+$/, "")}…`
}

// The reads on the title's own scale: the shape is the point, so a spike always reaches the top.
function Spark({ curve }: { curve: number[] }) {
	const { width, height } = SPARK
	const peak = Math.max(...curve, 1)
	const step = width / (curve.length - 1)
	const points = curve
		.map(
			(value, i) =>
				`${(i * step).toFixed(1)},${(height - 3 - (value / peak) * (height - 6)).toFixed(1)}`,
		)
		.join(" ")
	return (
		// biome-ignore lint/a11y/noSvgWithoutTitle: drawn into a card image
		<svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
			<polyline
				points={points}
				fill="none"
				stroke={AMBER}
				strokeWidth={4}
				strokeLinejoin="round"
				strokeLinecap="round"
			/>
		</svg>
	)
}

function TitleRow({ title }: { title: OgHotTitle }) {
	const rank = COPY.rank(title.rank)
	const name = clip(title.title)
	const fontSize =
		name.length <= NAME_LARGE.maxLength ? NAME_LARGE.fontSize : NAME_SMALL
	return (
		<div style={row({ height: ROW_HEIGHT, alignItems: "center", gap: GAP })}>
			<div
				style={{
					display: "flex",
					width: RANK_WIDTH,
					fontFamily: "Anton",
					// "#12" sets smaller, so it keeps to the rank's column.
					fontSize: rank.length > 2 ? 46 : 54,
					lineHeight: 1,
					color: AMBER,
				}}
			>
				{rank}
			</div>
			<div
				style={{
					display: "flex",
					width: NAME_WIDTH,
					maxHeight: Math.ceil(fontSize * NAME_LINE_HEIGHT * 3),
					overflow: "hidden",
					fontSize,
					fontWeight: 700,
					lineHeight: NAME_LINE_HEIGHT,
					color: "#fff",
				}}
			>
				{name}
			</div>
			{title.curve.length > 1 && <Spark curve={title.curve} />}
		</div>
	)
}

export function HotCard({ content }: { content: OgHotContent }) {
	return (
		<Frame>
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
					bottom: BOTTOM,
					width: TEXT_WIDTH,
					gap: 18,
					justifyContent: "flex-end",
				})}
			>
				<Tag text={COPY.tag} />
				<Headline
					text={COPY.headline}
					width={TEXT_WIDTH}
					height={HEIGHT - TEXT_TOP - BOTTOM - TAG_HEIGHT - 18}
					max={130}
				/>
			</div>
			<div
				style={col({
					position: "absolute",
					top: 0,
					left: PANEL_LEFT,
					width: 1200 - PANEL_LEFT,
					height: HEIGHT,
					backgroundColor: INK,
					padding: `${PANEL_PAD_Y}px ${PANEL_PAD_X}px`,
					justifyContent: "center",
				})}
			>
				{content.titles.slice(0, ROWS).map((title) => (
					<TitleRow key={`${title.rank}-${title.title}`} title={title} />
				))}
			</div>
		</Frame>
	)
}
