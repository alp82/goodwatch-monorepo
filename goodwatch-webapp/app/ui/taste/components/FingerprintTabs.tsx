import React from "react"
import { Swiper, SwiperSlide } from "swiper/react"
import { FreeMode } from "swiper/modules"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import type { FingerprintKeyResult } from "~/server/fingerprint-preview.server"

interface FingerprintTabsProps {
	keys: FingerprintKeyResult[]
	selectedKey: string | null
	onSelectKey: (key: string) => void
}

export default function FingerprintTabs({ keys, selectedKey, onSelectKey }: FingerprintTabsProps) {
	if (!keys.length) return null

	return (
		<div className="-mx-2">
			<Swiper
				modules={[FreeMode]}
				freeMode
				grabCursor
				slidesPerView="auto"
				spaceBetween={8}
			>
				{keys.map(({ key }, index) => {
					const meta = getFingerprintMeta(key)
					const isActive = selectedKey === key
					return (
						<SwiperSlide key={key} className="!w-auto">
							<button
								type="button"
								onClick={() => onSelectKey(key)}
								aria-pressed={isActive}
								className={
									"px-3 sm:px-4 py-2 rounded-lg border text-sm font-semibold transition-colors shadow-sm cursor-pointer " +
									(isActive
										? "text-white"
										: "bg-white/5 border-white/10 text-gray-200 hover:bg-white/10")
								}
								style={isActive ? { backgroundColor: meta.color, borderColor: meta.color } : undefined}
								title={meta.description}
							>
								<h3 className="flex items-center gap-2 text-xs sm:text-sm md:text-base lg:text-lg font-bold">
									<span aria-hidden>{meta.emoji}</span>
									<span>{meta.label}</span>
								</h3>
							</button>
						</SwiperSlide>
					)
				})}
			</Swiper>
		</div>
	)
}
