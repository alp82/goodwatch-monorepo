import { Link } from "@remix-run/react"
import React from "react"
import { Swiper, SwiperSlide } from "swiper/react"
import { FreeMode, Navigation } from "swiper/modules"
import "swiper/css"
import "swiper/css/navigation"
import type { Cast as CastType } from "~/server/details.server"

export interface CastProps {
	cast: CastType[]
}

export default function Cast({ cast }: CastProps) {
	const castWithPhotos = (cast || []).filter(
		(castMember) => castMember.profile_path,
	)
	if (!castWithPhotos.length) return null
	return (
		<>
			<h2 className="text-2xl font-bold mb-4">Cast</h2>
			<Swiper
				breakpoints={{
					480: { slidesPerView: 4, slidesPerGroup: 4 },
					640: { slidesPerView: 5, slidesPerGroup: 5 },
					768: { slidesPerView: 6, slidesPerGroup: 6 },
					1024: { slidesPerView: 7, slidesPerGroup: 7 },
					1280: { slidesPerView: 8, slidesPerGroup: 8 },
				}}
				freeMode={true}
				grabCursor={true}
				modules={[Navigation, FreeMode]}
				navigation={true}
				slidesPerView={3}
				slidesPerGroup={3}
				spaceBetween={4}
				speed={100}
				className="cast-swiper pb-6"
			>
				{castWithPhotos.map((castMember) => {
					const character =
						castMember.character || castMember.roles?.[0]?.character
					return (
						<SwiperSlide key={castMember.id}>
							<Link
								to={`/discover/all?withCast=${castMember.id}`}
								prefetch="intent"
								className="flex flex-col items-center group px-2"
							>
								<div className="w-36 h-36 mb-2 rounded-full overflow-hidden border-2 border-stone-400 shadow-lg group-hover:border-slate-200 transition-all">
									<img
										className="w-full h-full object-cover"
										src={`https://www.themoviedb.org/t/p/original/${castMember.profile_path}`}
										alt={`${castMember.name} profile`}
									/>
								</div>
								<p
									className="text-sm font-semibold text-center truncate w-36"
									title={castMember.name}
								>
									{castMember.name}
								</p>
								{character && (
									<p
										className="text-xs text-center text-gray-400 truncate w-36"
										title={character}
									>
										{character}
									</p>
								)}
							</Link>
						</SwiperSlide>
					)
				})}
			</Swiper>
		</>
	)
}
