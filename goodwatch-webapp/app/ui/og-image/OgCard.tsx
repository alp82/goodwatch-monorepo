// The Open Graph card for a page, one layout per kind of page:
// - Movies and shows: amber panel with the title and score, poster on the right.
// - People and collections: picture on the left, amber panel on the right.
// - Discover and Explorer: amber panel with the pitch, top-scored posters on a dark panel.
// - Use with AI: amber panel with the pitch, a chat answered with scored posters on a dark panel.
// - Member profiles: amber band with the picture and @handle; the taste fingerprint with its strongest pulls, or for a
//   tab, that tab's visual (ProfileCard.tsx); two Stats tab sections, you vs everyone and taste groups, have their own
//   (ProfileTasteCards.tsx).
// - New on your services (/new pages): the headline on amber, big service logos and flags at the right
//   (NewServicesCard.tsx).
// - For you: amber bar with the logo, the example taste print over a wall of top-scored posters (ForYouCard.tsx).
// - Rate titles (/taste/quiz): the page card's backdrop and band, with the rating flow's taste bar lit across the
//   seam (TasteQuizCard.tsx).
// - Every other page: backdrop across the top, amber band with the headline below.
// Image fields hold data URIs, so satori never fetches anything itself.
import { ChatCard } from "~/ui/og-image/ChatCard"
import {
	DiscoveryCard,
	type DiscoveryFeature,
} from "~/ui/og-image/DiscoveryCard"
import { ForYouCard, type OgForYouContent } from "~/ui/og-image/ForYouCard"
import {
	type OgTasteQuizContent,
	TasteQuizCard,
} from "~/ui/og-image/TasteQuizCard"
import {
	NewServicesCard,
	type OgNewServicesContent,
} from "~/ui/og-image/NewServicesCard"
import {
	type OgProfileContent,
	type OgProfileTabContent,
	ProfileCard,
	ProfileTabCard,
} from "~/ui/og-image/ProfileCard"
import {
	ProfileEveryoneCard,
	ProfileSidesCard,
} from "~/ui/og-image/ProfileTasteCards"
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
import type {
	OgProfileEveryoneContent,
	OgProfileSidesContent,
} from "~/ui/og-image/profile-card-model"
import { hasGoodwatchScore } from "~/utils/ratings"

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

// /use-with-ai: the posters that answer the chat.
export interface OgChatContent {
	kind: "chat"
	posters: OgPoster[]
}

export type {
	OgTasteQuizContent,
	OgNewServicesContent,
	OgProfileContent,
	OgProfileTabContent,
	OgProfileEveryoneContent,
	OgProfileSidesContent,
}

export type OgContent =
	| OgTasteQuizContent
	| OgNewServicesContent
	| OgForYouContent
	| OgProfileContent
	| OgProfileTabContent
	| OgProfileEveryoneContent
	| OgProfileSidesContent
	| OgChatContent
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
				{hasGoodwatchScore(content.score) && (
					<ScoreBlock score={content.score} />
				)}
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
	if (content.kind === "chat") return <ChatCard posters={content.posters} />
	if (content.kind === "for-you") return <ForYouCard content={content} />
	if (content.kind === "taste-quiz") return <TasteQuizCard content={content} />
	if (content.kind === "new-services")
		return <NewServicesCard content={content} />
	if (content.kind === "profile") return <ProfileCard content={content} />
	if (content.kind === "profile-tab")
		return <ProfileTabCard content={content} />
	if (content.kind === "profile-everyone")
		return <ProfileEveryoneCard content={content} />
	if (content.kind === "profile-sides")
		return <ProfileSidesCard content={content} />
	if (content.kind === "title") return <TitleCard content={content} />
	if (content.kind === "page") return <BandCard content={content} />
	return <SplitCard content={content} />
}
