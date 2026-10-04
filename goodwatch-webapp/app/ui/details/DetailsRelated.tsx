import { useQueryClient } from "@tanstack/react-query"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { FreeMode } from "swiper/modules"
import { Swiper, SwiperSlide } from "swiper/react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import RelatedTitles from "~/ui/details/RelatedTitles"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import {
	OVERALL_PANEL,
	activeRelatedPanelKey,
	relatedPanelKeys,
	relatedPanelParams,
	relatedPanelQueryOptions,
} from "~/utils/related-panel"

export interface DetailsRelatedProps {
	media: MovieResult | ShowResult
}

// How long the pointer or the focus rests on a tab before its panel is requested. Moving
// across the tab row on the way somewhere else requests nothing.
const INTENT_DELAY_MS = 150

export default function DetailsRelated({ media }: DetailsRelatedProps) {
	const { fingerprint } = media

	const keys = useMemo(() => relatedPanelKeys(fingerprint), [fingerprint])
	const [selectedKey, setSelectedKey] = useState<string>(OVERALL_PANEL)
	const activeKey = activeRelatedPanelKey(keys, selectedKey)

	// Only the selected panel is mounted. Another panel's data is requested when the visitor
	// shows intent for its tab (hover or focus), or selects it. A panel that is already in the
	// query cache is not requested again.
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

	if (!fingerprint) return null

	return (
		<section className="flex flex-col gap-6 rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
			<h2 className="text-2xl font-extrabold tracking-tight">
				Related Movies and Shows
			</h2>
			<div className="-mx-2">
				<Swiper
					modules={[FreeMode]}
					freeMode
					grabCursor
					slidesPerView="auto"
					spaceBetween={8}
				>
					{keys.map((key) => {
						const meta = getFingerprintMeta(key)
						const isActive = activeKey === key
						return (
							<SwiperSlide key={key} className="!w-auto">
								<button
									type="button"
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
											? {
													backgroundColor: meta.color,
													borderColor: meta.color,
												}
											: undefined
									}
									title={meta.description}
								>
									<h3 className="flex items-center gap-2 text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl font-bold">
										<span aria-hidden>{meta.emoji}</span>
										<span>{meta.label}</span>
									</h3>
								</button>
							</SwiperSlide>
						)
					})}
				</Swiper>
			</div>

			<RelatedTitles media={media} panelKey={activeKey} />
		</section>
	)
}
