import React from "react"
import { Swiper, SwiperSlide } from "swiper/react"
import { FreeMode } from "swiper/modules"

export interface ListSwiperSkeletonProps {
  count?: number
}

export default function ListSwiperSkeleton({ count = 8 }: ListSwiperSkeletonProps) {
  const items = Array.from({ length: count })

  return (
    <Swiper
      breakpoints={{
        320: { slidesPerView: 3, slidesPerGroup: 3, spaceBetween: 3 },
        480: { slidesPerView: 4, slidesPerGroup: 4, spaceBetween: 4 },
        640: { slidesPerView: 5, slidesPerGroup: 5, spaceBetween: 5 },
        768: { slidesPerView: 6, slidesPerGroup: 6, spaceBetween: 6 },
        1024: { slidesPerView: 7, slidesPerGroup: 7, spaceBetween: 7 },
        1280: { slidesPerView: 8, slidesPerGroup: 8, spaceBetween: 8 },
      }}
      freeMode
      grabCursor
      rewind
      slidesPerView={4}
      slidesPerGroup={4}
      spaceBetween={4}
      speed={100}
      modules={[FreeMode]}
    >
      {items.map((_, idx) => (
        <SwiperSlide key={idx}>
          <div
            className="@container flex flex-col w-full bg-gray-900 border-4 rounded-lg border-gray-800 pointer-events-none"
          >
            <div className="relative">
              {/* Poster skeleton with 2:3 aspect ratio */}
              <div className="w-full rounded-md bg-gray-800 animate-pulse">
                <div className="relative w-full pt-[150%] rounded-md" />
              </div>
              {/* Optional title strip placeholder visible on larger tiles */}
              <div className="hidden @6xs:flex items-end absolute bottom-0 w-full min-h-40 px-2 py-2 bg-gradient-to-t from-black/70 to-transparent overflow-hidden">
                <div className="h-3 w-2/3 rounded bg-white/20" />
              </div>
            </div>
          </div>
        </SwiperSlide>
      ))}
    </Swiper>
  )
}
