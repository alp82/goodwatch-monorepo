import { Link } from "@remix-run/react"
import React from "react"
import { SwiperSlide } from "swiper/react"
import "swiper/css"
import "swiper/css/navigation"
import ListSwiper from "~/ui/ListSwiper"
import type { Actor } from "~/server/types/details-types"

export interface CastProps {
	actors: Actor[]
}

export default function Actors({ actors }: CastProps) {
	const actorsWithPhotos = (actors || []).filter(
		(castMember) => castMember.profile_path,
	)

	const uniqueActors = actorsWithPhotos
		.reduce<(Actor & { characters: string[] })[]>((acc, actor) => {
			const existing = acc.find((a) => a.id === actor.id)
			if (existing) {
				if (actor.character && !existing.characters.includes(actor.character)) {
					existing.characters.push(actor.character)
				}
			} else {
				acc.push({
					...actor,
					characters: actor.character ? [actor.character] : [],
				} as Actor & { characters: string[] })
			}
			return acc
		}, [])
		.sort((a, b) => a.order_default - b.order_default)

	if (!uniqueActors.length) return null
	return (
		<>
			<h2 className="text-2xl font-bold mb-4">Actors</h2>
			<ListSwiper>
				{uniqueActors.map((actor) => {
					const characterText = actor.characters?.join(", ") || undefined
					return (
						<SwiperSlide key={actor.id}>
							<Link
								to={`/discover/all?withCast=${actor.id}`}
								prefetch="intent"
								className="flex flex-col items-center group px-2"
							>
								<div className="w-36 h-36 mb-2 rounded-full overflow-hidden border-2 border-stone-400 shadow-lg group-hover:border-slate-200 transition-all">
									<img
										className="w-full h-full object-cover"
										src={`https://www.themoviedb.org/t/p/original/${actor.profile_path}`}
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
