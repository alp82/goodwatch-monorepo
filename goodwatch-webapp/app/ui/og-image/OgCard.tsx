// The Open Graph card for a page, one layout per kind of page:
// - Movies and shows: amber panel with the title and score, poster on the right.
// - People and collections: picture on the left, amber panel on the right.
// - Discover and Explorer: amber panel with the pitch, top-scored posters on a dark panel.
// - Every other page: backdrop across the top, amber band with the headline below.
// Image fields hold data URIs, so satori never fetches anything itself.
import {
	DiscoveryCard,
	type DiscoveryFeature,
} from "~/ui/og-image/DiscoveryCard"
import {
	Brand,
	Frame,
	Headline,
	INK,
	PROVIDER_LOGOS,
	Picture,
	ScoreBlock,
	Subtext,
	Tag,
	col,
	fitFontSize,
	headlineText,
} from "~/ui/og-image/parts"

export interface OgTitleContent {
	kind: "title"
	tag: string
	title: string
	score: number | null
	poster: string | null
}

export interface OgPersonContent {
	kind: "person"
	tag: string
	name: string
	photo: string | null
}

export interface OgCollectionContent {
	kind: "collection"
	tag: string
	title: string
	subtitle: string
	backdrop: string | null
	// TMDB watch provider id, set on streaming pages
	providerId: string | null
}

export interface OgPageContent {
	kind: "page"
	tag: string
	title: string
	subtitle: string
	backdrop: string | null
}

export interface OgPoster {
	src: string | null
	score: number | null
}

// Discover has one group of posters. Explorer has two islands, then the bridge between them.
export interface OgDiscoveryContent {
	kind: "discovery"
	feature: DiscoveryFeature
	groups: { label: string; posters: OgPoster[] }[]
}

export type OgContent =
	| OgDiscoveryContent
	| OgTitleContent
	| OgPersonContent
	| OgCollectionContent
	| OgPageContent

function TitleCard({ content }: { content: OgTitleContent }) {
	return (
		<Frame>
			<Picture
				src={content.poster}
				alignTop
				style={{ top: 0, left: 780, width: 420, height: 630 }}
			/>
			<div style={{ position: "absolute", top: 44, left: 56, display: "flex" }}>
				<Brand dark />
			</div>
			<div
				style={col({
					position: "absolute",
					left: 56,
					bottom: 52,
					width: 670,
					gap: 18,
				})}
			>
				<Tag text={content.tag} />
				<Headline
					text={content.title}
					sizes={[
						[9, 176],
						[11, 140],
						[16, 112],
						[24, 88],
						[30, 76],
						[999, 58],
					]}
				/>
				{content.score != null && <ScoreBlock score={content.score} />}
			</div>
		</Frame>
	)
}

function SplitCard({
	content,
}: { content: OgPersonContent | OgCollectionContent }) {
	const isPerson = content.kind === "person"
	const picture = isPerson ? content.photo : content.backdrop
	const providerLogo =
		!isPerson && content.providerId
			? PROVIDER_LOGOS[content.providerId]
			: undefined
	return (
		<Frame>
			<Picture
				src={picture}
				alignTop={isPerson}
				style={{ top: 0, left: 0, width: 560, height: 630 }}
			/>
			{providerLogo && (
				<div
					style={col({
						position: "absolute",
						top: 0,
						left: 0,
						width: 560,
						height: 630,
						backgroundColor: "rgba(10,10,10,0.72)",
						alignItems: "center",
						justifyContent: "center",
					})}
				>
					<img
						alt=""
						src={providerLogo}
						style={{ maxWidth: 400, maxHeight: 180, objectFit: "contain" }}
					/>
				</div>
			)}
			<div
				style={{ position: "absolute", top: 44, left: 616, display: "flex" }}
			>
				<Brand dark />
			</div>
			<div
				style={col({
					position: "absolute",
					left: 616,
					bottom: 52,
					width: 540,
					gap: 16,
				})}
			>
				<Tag text={content.tag} />
				<Headline
					text={isPerson ? content.name : content.title}
					sizes={[
						[8, 156],
						[12, 124],
						[18, 98],
						[28, 76],
						[999, 58],
					]}
				/>
				<Subtext text={isPerson ? null : content.subtitle} />
			</div>
		</Frame>
	)
}

function BandCard({ content }: { content: OgPageContent }) {
	return (
		<Frame>
			<Picture
				src={content.backdrop}
				style={{ top: 0, left: 0, width: 1200, height: 340 }}
			/>
			<div
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					width: 1200,
					height: 160,
					display: "flex",
					backgroundImage:
						"linear-gradient(180deg, rgba(10,10,10,0.65) 0%, rgba(10,10,10,0) 100%)",
				}}
			/>
			<div style={{ position: "absolute", top: 36, left: 56, display: "flex" }}>
				<Brand />
			</div>
			<div
				style={col({
					position: "absolute",
					top: 340,
					left: 56,
					right: 56,
					bottom: 0,
					justifyContent: "center",
					gap: 14,
				})}
			>
				<Tag text={content.tag} />
				<div
					style={{
						display: "flex",
						fontFamily: "Anton",
						fontSize: fitFontSize(content.title, [
							[14, 136],
							[22, 108],
							[34, 80],
							[999, 60],
						]),
						lineHeight: 0.95,
						color: INK,
					}}
				>
					{headlineText(content.title)}
				</div>
				<Subtext text={content.subtitle} />
			</div>
		</Frame>
	)
}

export function OgCard({ content }: { content: OgContent }) {
	if (content.kind === "discovery") return <DiscoveryCard content={content} />
	if (content.kind === "title") return <TitleCard content={content} />
	if (content.kind === "page") return <BandCard content={content} />
	return <SplitCard content={content} />
}
