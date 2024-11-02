import { Link } from "@remix-run/react"
import React from "react"
import type { Cast as CastType } from "~/server/details.server"

export interface CastProps {
	cast: CastType[]
}

export default function Cast({ cast }: CastProps) {
	const [showAll, setShowAll] = React.useState(false)
	const toggleShowAll = () => setShowAll(!showAll)

	const castWithPhotos = (cast || []).filter(
		(castMember) => castMember.profile_path,
	)
	const castWithoutPhotos = (cast || []).filter(
		(castMember) => !castMember.profile_path,
	)

	const castToShow = showAll ? castWithPhotos : castWithPhotos.slice(0, 10)
	const numberOfMoreToShow =
		castWithPhotos.length + castWithoutPhotos.length - 10

	return (
		<>
			<h2 className="text-2xl font-bold">Cast</h2>
			<div className="mt-4 flex flex-wrap gap-2">
				{castToShow.map((castMember) => {
					const character =
						castMember.character || castMember.roles?.[0].character
					return (
						<Link
							key={castMember.id}
							className="w-28 h-60 border-2 border-gray-700 flex flex-col items-center group"
							to={`/discover/all?withCast=${castMember.id}`}
							prefetch="intent"
						>
							<img
								className="w-full h-auto"
								src={`https://www.themoviedb.org/t/p/original/${castMember.profile_path}`}
								alt={`${castMember.name} profile`}
							/>
							<div className="w-full h-full px-2 bg-gray-800 group-hover:bg-slate-800">
								<p
									className="text-sm text-center font-bold truncate w-full mt-3"
									title={castMember.name}
								>
									{castMember.name}
								</p>
								<p
									className="text-sm text-center font-italic truncate w-full mt-2"
									title={character}
								>
									{character}
								</p>
							</div>
						</Link>
					)
				})}
			</div>
			{showAll && castWithoutPhotos.length > 0 && (
				<div className="mt-8 flex flex-wrap gap-4">
					{castWithoutPhotos.map((castMember) => {
						const character =
							castMember.character || castMember.roles?.[0].character
						return (
							<Link
								key={castMember.id}
								className="w-64 h-16 hover:bg-slate-800"
								to={`/discover/all?withCast=${castMember.id}`}
								prefetch="intent"
							>
								<strong>{castMember.name}</strong>{" "}
								{character && (
									<>
										as <em>{character}</em>
									</>
								)}
							</Link>
						)
					})}
				</div>
			)}
			{numberOfMoreToShow > 0 && (
				<button
					type="button"
					className="mt-4 text-indigo-400"
					onClick={toggleShowAll}
				>
					Show {numberOfMoreToShow} {showAll ? "Less" : "More"}
				</button>
			)}
		</>
	)
}
