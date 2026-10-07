// PROTOTYPE for "Prototype native-scroll carousels on title pages". Throwaway code: not for production.
//
// Variant "rows": today's related titles section (ui/details/DetailsRelated.tsx and RelatedTitles.tsx) with the
// browser's own scrolling in place of the three Swiper instances. Same tabs, same panels, same cards.
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRelatedPanel } from "~/routes/api.related"
import type { DiscoverResults } from "~/server/discover.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { MovieTvCard } from "~/ui/MovieTvCard"
import { POSTER_ROW_SIZES } from "~/ui/Poster"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { NativeRow } from "~/ui/prototype-carousels/NativeRow"
import {
	OVERALL_PANEL,
	type RelatedCard,
	activeRelatedPanelKey,
	relatedPanelKeys,
	relatedPanelParams,
	relatedPanelQueryOptions,
} from "~/utils/related-panel"

type Media = MovieResult | ShowResult

const INTENT_DELAY_MS = 150
const NO_CARDS: RelatedCard[] = []
const SKELETON = Array.from({ length: 8 }, (_, index) => index)

function Row({
	title,
	mediaType,
	cards,
	isLoading,
	panelKey,
}: {
	title: string
	mediaType: "movie" | "show"
	cards: RelatedCard[]
	isLoading: boolean
	panelKey: string
}) {
	const results = useMemo(
		() =>
			cards.map((card) => ({
				...card,
				media_type: mediaType,
			})) as unknown as DiscoverResults,
		[cards, mediaType],
	)
	// Another panel starts at its first title.
	const track = useRef<HTMLDivElement>(null)
	useEffect(() => {
		track.current?.scrollTo({ left: 0 })
		track.current?.dispatchEvent(new Event("scroll"))
	}, [panelKey, cards])
	return (
		<div className="mt-6">
			<h3 className="flex items-center gap-2 text-xl font-bold">{title}</h3>
			{!isLoading && results.length === 0 ? (
				<div className="h-[170px]" />
			) : (
				<NativeRow columns label={`Related ${title}`} trackRef={track}>
					{isLoading
						? SKELETON.map((index) => (
								<div key={index}>
									<div className="bg-gray-900 border-4 border-gray-800 rounded-lg pointer-events-none">
										<div className="aspect-[2/3] bg-gray-800 animate-pulse" />
									</div>
								</div>
							))
						: results.map((details) => (
								<div key={`${details.media_type}-${details.tmdb_id}`}>
									<MovieTvCard
										details={details}
										mediaType={details.media_type}
										posterSizes={POSTER_ROW_SIZES}
									/>
								</div>
							))}
				</NativeRow>
			)}
		</div>
	)
}

export default function RelatedRowsNative({ media }: { media: Media }) {
	const { fingerprint, mediaType } = media
	const keys = useMemo(() => relatedPanelKeys(fingerprint), [fingerprint])
	const [selectedKey, setSelectedKey] = useState<string>(OVERALL_PANEL)
	const activeKey = activeRelatedPanelKey(keys, selectedKey)

	const queryClient = useQueryClient()
	const intentTimer = useRef<ReturnType<typeof setTimeout>>()
	const cancelIntent = () => clearTimeout(intentTimer.current)
	const prefetchOnIntent = (key: string) => {
		cancelIntent()
		intentTimer.current = setTimeout(() => {
			queryClient.prefetchQuery(
				relatedPanelQueryOptions(relatedPanelParams(media, key)),
			)
		}, INTENT_DELAY_MS)
	}
	useEffect(() => cancelIntent, [])

	// A tap on a tab that came before hydration (NativeRow's inline script marked the button) selects it now.
	const tabs = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const tapped = tabs.current?.querySelectorAll<HTMLElement>("[data-tapped]")
		const key = tapped?.[tapped.length - 1]?.dataset.panelKey
		if (key) setSelectedKey(key)
	}, [])

	const panel = useRelatedPanel(relatedPanelParams(media, activeKey))
	const isLoading = panel.isPending
	const meta = getFingerprintMeta(activeKey)

	if (!fingerprint) return null

	const row = (type: "movie" | "show") => (
		<Row
			key={type}
			title={type === "movie" ? "Movies" : "Shows"}
			mediaType={type}
			cards={
				(type === "movie" ? panel.data?.movies : panel.data?.shows) ?? NO_CARDS
			}
			isLoading={isLoading}
			panelKey={activeKey}
		/>
	)

	return (
		<section className="flex flex-col gap-6 rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
			<h2 className="text-2xl font-extrabold tracking-tight">
				Related Movies and Shows
			</h2>
			<div className="-mx-2" ref={tabs}>
				<NativeRow
					arrows={false}
					label="Related titles by attribute"
					trackClassName="gap-2 px-2 [scroll-snap-type:none]"
				>
					{keys.map((key) => {
						const tab = getFingerprintMeta(key)
						const isActive = activeKey === key
						return (
							<button
								key={key}
								type="button"
								data-early-tap=""
								data-panel-key={key}
								onClick={() => {
									cancelIntent()
									setSelectedKey(key)
								}}
								onMouseEnter={() => prefetchOnIntent(key)}
								onMouseLeave={cancelIntent}
								onFocus={() => prefetchOnIntent(key)}
								onBlur={cancelIntent}
								aria-pressed={isActive}
								className={`px-3 sm:px-4 py-2 rounded-lg border text-sm font-semibold transition-colors shadow-sm ${
									isActive
										? "text-white"
										: "bg-white/5 border-white/10 text-gray-200 hover:bg-white/10"
								}`}
								style={
									isActive
										? { backgroundColor: tab.color, borderColor: tab.color }
										: undefined
								}
								title={tab.description}
							>
								<h3 className="flex items-center gap-2 text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl font-bold whitespace-nowrap">
									<span aria-hidden>{tab.emoji}</span>
									<span>{tab.label}</span>
								</h3>
							</button>
						)
					})}
				</NativeRow>
			</div>

			<div className="flex flex-col gap-4" aria-busy={isLoading}>
				<div className="my-1">
					<p className="mt-2 text-xl text-gray-300">
						<span className="flex items-center gap-2 text-xl">
							<span aria-hidden>{meta.emoji}</span>
							<span className="font-bold">{meta.label}: </span>
							{meta.description}
						</span>
					</p>
				</div>
				{mediaType === "movie"
					? [row("movie"), row("show")]
					: [row("show"), row("movie")]}
			</div>
		</section>
	)
}
