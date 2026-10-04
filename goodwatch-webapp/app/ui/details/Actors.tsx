import { Link } from "@remix-run/react"
import React from "react"
import { SwiperSlide } from "swiper/react"
import "swiper/css"
import "swiper/css/navigation"
import type { CastMember } from "~/server/types/details-types"
import ListSwiper from "~/ui/ListSwiper"
import { TmdbImage } from "~/ui/TmdbImage"
import { personPath } from "~/utils/helpers"

export interface CastProps {
	/** The top-billed cast, which is in the document. */
	cast: CastMember[]
}

export default function Actors({ cast }: CastProps) {
	if (!cast.length) return null
	return (
		<>
			<h2 className="text-2xl font-bold mb-4">Actors</h2>
			<ListSwiper>
				{cast.map((actor) => {
					const characterText = actor.characters.join(", ") || undefined
					return (
						<SwiperSlide key={actor.id}>
							<Link
								to={personPath(actor.id, actor.name)}
								prefetch="intent"
								className="flex flex-col items-center group px-2"
							>
								<div className="w-36 h-36 mb-2 rounded-full overflow-hidden border-2 border-stone-400 shadow-lg group-hover:border-slate-200 transition-all">
									<TmdbImage
										kind="profile"
										path={actor.profile_path}
										width={144}
										className="w-full h-full object-cover"
										alt={`${actor.name} profile`}
									/>
								</div>
								<p
									className="text-sm font-semibold text-center truncate w-36"
									title={actor.name}
								>
									{actor.name}
								</p>
								{characterText && (
									<p
										className="text-xs text-center text-gray-400 truncate w-36"
										title={characterText}
									>
										{characterText}
									</p>
								)}
							</Link>
						</SwiperSlide>
					)
				})}
			</ListSwiper>
		</>
	)
}
