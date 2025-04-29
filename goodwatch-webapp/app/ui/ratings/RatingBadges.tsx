import React from "react"
import gwLogo from "~/img/goodwatch-logo-white.svg"
import imdbLogo from "~/img/imdb-logo-250.png"
import metacriticLogo from "~/img/metacritic-logo-250.png"
import metacriticLogoIcon from "~/img/metacritic-logo-icon-250.png"
import rottenLogo from "~/img/rotten-logo-250.png"
import rottenLogoIcon from "~/img/rotten-logo-icon-250.png"
import { type AllRatings, scoreLabels } from "~/utils/ratings"
import { useUserData } from "~/routes/api.user-data"
import type { MovieDetails, TVDetails } from "~/server/details.server"

export interface RatingBadgesProps {
	details: MovieDetails | TVDetails
	ratings: AllRatings
	onToggleRate: () => void
}

export default function RatingBadges({
	details,
	ratings,
	onToggleRate,
}: RatingBadgesProps) {
	const { tmdb_id, media_type } = details

	const { data: userData } = useUserData()
	const userScore = userData?.[media_type]?.[tmdb_id]?.score || null

	const vibeColorIndex = ratings?.aggregated_overall_score_normalized_percent
		? Math.floor(ratings.aggregated_overall_score_normalized_percent / 10) * 10
		: null

	const userColorIndex = userScore ? userScore * 10 : null

	return (
		<div className="w-full flex flex-col sm:flex-row items-center sm:justify-between gap-4">
			<div className="w-full sm:w-auto flex items-center justify-between gap-4 lg:gap-12">
				<dl
					className={`${ratings?.aggregated_overall_score_normalized_percent ? "" : "opacity-60"} flex items-center gap-2`}
				>
					<img
						className={`block h-10 xs:h-12 p-2 rounded-full shadow-2xl ${vibeColorIndex == null ? "bg-gray-950" : `bg-vibe-${vibeColorIndex}`}`}
						src={gwLogo}
						alt="GoodWatch Logo"
					/>
					<dd className="text-base xs:text-lg md:text-xl relative top-1">
						{ratings?.aggregated_overall_score_normalized_percent ? (
							<>
								<span
									className={`text-[200%] font-semibold ${vibeColorIndex == null ? "text-gray-300" : `text-vibe-${vibeColorIndex}`}`}
								>
									{Math.floor(
										ratings?.aggregated_overall_score_normalized_percent,
									)}
								</span>
								<span className="hidden xs:inline text-gray-300 font-normal">
									/100
								</span>
							</>
						) : (
							"-"
						)}
					</dd>
				</dl>

				<div
					className="
						flex items-center gap-2 p-2.5 md:p-3
						bg-gray-700/70 hover:bg-gray-700
						rounded-lg border-2 border-transparent hover:border-gray-600/50
						cursor-pointer
					"
					onClick={onToggleRate}
					onKeyDown={() => {}}
				>
					{userScore && (
						<div
							className={`
										flex items-center justify-center
										p-0.5 w-10 h-10 md:w-12 md:h-12
										rounded-full ${userColorIndex == null ? "bg-gray-950" : `bg-vibe-${userColorIndex}`} 
										text-xl md:text-2xl font-semibold text-center text-white
									`}
						>
							<span className="w-full">{userScore}</span>
						</div>
					)}
					<div className="flex flex-col text-sm md:text-lg">
						<span className="text-gray-300 font-light text-[70%]">
							My Score
						</span>
						<span
							className={`
								${userColorIndex == null ? "text-gray-200" : `text-vibe-${userColorIndex}`} 
								font-semibold text-center
							`}
						>
							{userScore ? scoreLabels[userScore] : scoreLabels[0]}
						</span>
					</div>
				</div>
			</div>

			<div className="w-full sm:w-auto flex items-center justify-between gap-3 sm:gap-1.5 md:gap-4 lg:gap-6">
				<a
					className=""
					href={ratings?.imdb_url}
					target="_blank"
					rel="noreferrer"
				>
					<dl
						className={`
							${ratings?.imdb_url ? "hover:border-white/[.45] active:border-white/[.45]" : "opacity-60"}
							h-full py-0.5 sm:py-2 px-4 xs:px-8 sm:px-3
							flex flex-col items-center gap-1
							bg-imdb shadow-2xl overflow-hidden rounded-lg
							text-center brightness-[.8] hover:brightness-100
						`}
					>
						<img
							className="block h-6 sm:h-4 md:h-6 object-contain"
							src={imdbLogo}
							alt="IMDb Logo"
						/>
						<dd className="text-lg sm:text-lg md:text-2xl font-semibold tracking-tight text-gray-900">
							{ratings?.imdb_user_score_original
								? ratings?.imdb_user_score_original.toFixed(1)
								: "–"}
						</dd>
					</dl>
				</a>

				<a
					className=""
					href={ratings?.metacritic_url}
					target="_blank"
					rel="noreferrer"
				>
					<dl
						className={`
							${ratings?.metacritic_url ? "hover:border-black/[.45] active:border-black/[.45]" : "opacity-60"}
							h-full py-1 sm:py-2 px-4 xs:px-8 sm:px-3
							flex flex-col items-center gap-0.5 sm:gap-2
							bg-metacritic shadow-2xl overflow-hidden rounded-lg
							text-center brightness-[.8] hover:brightness-100
						`}
					>
						<img
							className="h-7 sm:h-5 md:h-7 object-contain"
							src={metacriticLogo}
							alt="Metacritic Logo"
						/>
						<dd className="flex gap-1 xs:gap-2 text-lg md:text-2xl font-semibold tracking-tight text-gray-100">
							<span>
								{ratings?.metacritic_meta_score_original
									? Math.floor(ratings?.metacritic_meta_score_original)
									: "–"}
							</span>
							<span className="text-[80%] font-light">|</span>
							<span>
								{ratings?.metacritic_user_score_original
									? ratings?.metacritic_user_score_original.toFixed(1)
									: "–"}
							</span>
						</dd>
					</dl>
				</a>

				<a
					className=""
					href={ratings?.rotten_tomatoes_url}
					target="_blank"
					rel="noreferrer"
				>
					<dl
						className={`
							${ratings?.rotten_tomatoes_url ? "hover:border-white/[.45] active:border-white/[.45]" : "opacity-60"}
							h-full py-1 sm:py-2 px-4 xs:px-8 sm:px-3
							flex flex-col items-center gap-0.5 sm:gap-2
							bg-rotten shadow-2xl overflow-hidden rounded-lg
							text-center brightness-[0.8] hover:brightness-100
						`}
					>
						<img
							className="block h-6 sm:h-4 md:h-6 object-contain"
							src={rottenLogo}
							alt="Rotten Tomatoes Logo"
						/>
						<dd className="flex gap-1 xs:gap-2 text-lg md:text-2xl font-semibold tracking-tight text-gray-50">
							<span>
								{ratings?.rotten_tomatoes_tomato_score_original
									? Math.floor(ratings?.rotten_tomatoes_tomato_score_original)
									: "–"}
							</span>
							<span className="text-[80%] font-light">|</span>
							<span>
								{ratings?.rotten_tomatoes_audience_score_original
									? Math.floor(ratings?.rotten_tomatoes_audience_score_original)
									: "–"}
							</span>
						</dd>
					</dl>
				</a>
			</div>
		</div>
	)
}
