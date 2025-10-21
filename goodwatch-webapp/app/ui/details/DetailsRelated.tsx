import React, { useEffect, useMemo, useState } from "react"
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

    const keys = useMemo(() => ["overall", ...(fingerprint?.highlightKeys ?? [])], [fingerprint])
    const [selectedKey, setSelectedKey] = useState<string>("overall")
    const selectedMeta = selectedKey ? getFingerprintMeta(selectedKey) : null

    useEffect(() => {
        if (!keys.includes(selectedKey)) setSelectedKey("overall")
    }, [keys])

    if (!keys.length) return null

    // removed unused renderPill helper

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
                                        "px-3 sm:px-4 py-2 rounded-lg border text-sm font-semibold transition-colors shadow-sm " +
                                        (isActive
                                            ? "text-white"
                                            : "bg-white/5 border-white/10 text-gray-200 hover:bg-white/10")
                                    }
                                    style={isActive ? { backgroundColor: meta.color, borderColor: meta.color } : undefined}
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

            <div className="relative">
                {keys.map((key) => (
                    <div
                        key={key}
                        aria-hidden={selectedKey !== key}
                        className={
                            selectedKey === key
                                ? "relative"
                                : "absolute inset-0 opacity-0 pointer-events-none -z-10"
                        }
                    >
                        <RelatedTitles media={media} fingerprintKey={key === "overall" ? undefined : key} />
                    </div>
                ))}
            </div>
        </section>
    )
}
