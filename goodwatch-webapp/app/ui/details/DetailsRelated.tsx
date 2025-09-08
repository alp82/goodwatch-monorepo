import React, { useMemo, useState } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import RelatedTitles from "~/ui/details/RelatedTitles"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { Swiper, SwiperSlide } from "swiper/react"
import { FreeMode } from "swiper/modules"

export interface DetailsRelatedProps {
    media: MovieResult | ShowResult
}

export default function DetailsRelated({ media }: DetailsRelatedProps) {
    const { fingerprint } = media

    const keys = useMemo(() => fingerprint?.highlightKeys ?? [], [fingerprint])
    const [selectedKey, setSelectedKey] = useState<string>(keys[0] ?? "")
    const selectedMeta = selectedKey ? getFingerprintMeta(selectedKey) : null

    if (!keys.length) return null

    const renderPill = (key: string) => {
        const meta = getFingerprintMeta(key)
        const isActive = selectedKey === key
        return (
            <button
                key={key}
                type="button"
                onClick={() => setSelectedKey(key)}
                aria-pressed={isActive}
                className={
                    `flex items-center gap-2 px-3 py-1.5 rounded-full border whitespace-nowrap ` +
                    (isActive
                        ? "bg-white/10 border-white/20 text-white"
                        : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10")
                }
                title={meta.description}
            >
                <span aria-hidden>{meta.emoji}</span>
                <span className="text-sm font-medium">{meta.label}</span>
            </button>
        )
    }

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
                        const isActive = selectedKey === key
                        return (
                            <SwiperSlide key={key} className="!w-auto">
                                <button
                                    type="button"
                                    onClick={() => setSelectedKey(key)}
                                    aria-pressed={isActive}
                                    className={
                                        "flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full border text-sm font-semibold transition-colors shadow-sm " +
                                        (isActive
                                            ? "text-white"
                                            : "bg-white/5 border-white/10 text-gray-200 hover:bg-white/10")
                                    }
                                    style={isActive ? { backgroundColor: meta.color, borderColor: meta.color } : undefined}
                                    title={meta.description}
                                >
                                    <span aria-hidden>{meta.emoji}</span>
                                    <span>{meta.label}</span>
                                </button>
                            </SwiperSlide>
                        )
                    })}
                </Swiper>
            </div>

            {selectedKey && (
                <RelatedTitles media={media} fingerprintKey={selectedKey} />
            )}
        </section>
    )
}
