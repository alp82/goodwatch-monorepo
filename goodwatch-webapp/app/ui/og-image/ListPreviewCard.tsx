// The link preview (Open Graph image, 1200x630) of a share list page, in the style of the other page previews:
// amber frame, ink brand and headline, and the ranked posters along the bottom edge. #1 stands taller than the rest.
// The list's color theme only tints the rank numbers, so every list still reads as GoodWatch.
// Image fields hold data URIs, so satori never fetches anything itself.
import {
	AMBER,
	Brand,
	Frame,
	Headline,
	INK,
	Tag,
	col,
	row,
} from "~/ui/og-image/parts"

export interface ListPreviewTitle {
	title: string
	poster: string | null
}

export interface ListPreviewContent {
	title: string
	// Who made the list, as the card signs it: the signature, or @handle.
	byline: string
	accent: string
	items: ListPreviewTitle[]
}

const MARGIN = 56
const FIRST = { w: 220, h: 330 }
const REST = { w: 190, h: 285 }
const BOTTOM = 630

// Poster, or the title set in type when a title has no poster.
function Poster({
	item,
	w,
	h,
	rank,
	accent,
}: {
	item: ListPreviewTitle
	w: number
	h: number
	rank: number
	accent: string
}) {
	const badge = rank === 1 ? 72 : 60
	return (
		<div
			style={col({
				position: "relative",
				width: w,
				height: h,
				borderRadius: "16px 16px 0 0",
				overflow: "hidden",
				backgroundColor: INK,
				boxShadow: "0 18px 40px rgba(10,10,10,0.35)",
			})}
		>
			{item.poster ? (
				<img
					alt=""
					src={item.poster}
					width={w}
					height={h}
					style={{ width: w, height: h, objectFit: "cover" }}
				/>
			) : (
				<div
					style={col({
						width: w,
						height: h,
						padding: "96px 20px 20px",
						justifyContent: "center",
						fontSize: 28,
						fontWeight: 900,
						lineHeight: 1.1,
						color: AMBER,
					})}
				>
					{item.title}
				</div>
			)}
			<div
				style={row({
					position: "absolute",
					top: 12,
					left: 12,
					width: badge,
					height: badge,
					borderRadius: 12,
					backgroundColor: INK,
					alignItems: "center",
					justifyContent: "center",
					fontFamily: "Anton",
					fontSize: rank === 1 ? 54 : 44,
					color: accent,
				})}
			>
				{String(rank)}
			</div>
		</div>
	)
}

export function ListPreviewCard({ content }: { content: ListPreviewContent }) {
	const items = content.items.slice(0, 5)
	const gap =
		items.length > 1
			? (1200 - 2 * MARGIN - FIRST.w - (items.length - 1) * REST.w) /
				(items.length - 1)
			: 0
	return (
		<Frame>
			<div
				style={row({
					position: "absolute",
					top: 40,
					left: MARGIN,
					right: MARGIN,
					justifyContent: "space-between",
					alignItems: "center",
				})}
			>
				<Brand dark />
				<Tag text={`Top ${items.length} · by ${content.byline}`} />
			</div>
			<div
				style={col({
					position: "absolute",
					top: 118,
					left: MARGIN,
					width: 1200 - 2 * MARGIN,
					height: 170,
					justifyContent: "center",
				})}
			>
				<Headline
					text={content.title}
					sizes={[
						[20, 120],
						[26, 96],
						[33, 76],
						[80, 64],
						[999, 52],
					]}
				/>
			</div>
			<div
				style={row({
					position: "absolute",
					left: MARGIN,
					bottom: 0,
					height: FIRST.h,
					alignItems: "flex-end",
					gap: Math.min(gap, 40),
				})}
			>
				{items.map((item, i) => (
					<Poster
						key={`${i}-${item.title}`}
						item={item}
						rank={i + 1}
						accent={content.accent}
						w={i === 0 ? FIRST.w : REST.w}
						h={i === 0 ? FIRST.h : REST.h}
					/>
				))}
			</div>
		</Frame>
	)
}

export const LIST_PREVIEW_SIZE = { width: 1200, height: BOTTOM }
