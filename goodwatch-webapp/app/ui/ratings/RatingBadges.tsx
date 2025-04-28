import React, { useState } from "react"
import gwLogo from "~/img/goodwatch-logo-white.svg"
import imdbLogo from "~/img/imdb-logo-250.png"
import metacriticLogo from "~/img/metacritic-logo-250.png"
import metacriticLogoIcon from "~/img/metacritic-logo-icon-250.png"
import rottenLogo from "~/img/rotten-logo-250.png"
import rottenLogoIcon from "~/img/rotten-logo-icon-250.png"
import InfoBox from "~/ui/InfoBox"
import type { AllRatings } from "~/utils/ratings"
import type { Section } from "~/utils/scroll"

export interface RatingBadgesProps {
	ratings: AllRatings
	onToggleRate: () => void
}

export default function RatingBadges({
	ratings,
	onToggleRate,
}: RatingBadgesProps) {
	const vibeColorIndex = ratings?.aggregated_overall_score_normalized_percent
		? Math.floor(ratings.aggregated_overall_score_normalized_percent / 10) * 10
		: null

	return (
		<div className="w-full flex items-center justify-between gap-4">
			<div className="flex flex-col gap-2">
				<dl
					className={`${ratings?.aggregated_overall_score_normalized_percent ? "" : "opacity-60"} flex items-center gap-2`}
				>
					<img
						className={`block h-10 xs:h-12 p-2 rounded-full shadow-2xl ${vibeColorIndex == null ? "bg-gray-950" : `bg-vibe-${vibeColorIndex}`}`}
						src={gwLogo}
						alt="GoodWatch Logo"
					/>
					<dd className="text-base xs:text-xl relative top-1">
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

				<div className="flex items-center justify-between gap-2">
					<span className="text-gray-400 text-sm">How would you</span>
					<button
						className="
										flex items-center gap-2 px-2 py-1
										text-gray-300 hover:text-gray-100 bg-black/20 hover:bg-black/30 rounded-lg border-2 border-gray-700
										font-semibold  text-xs md:text-sm shadow transition-all duration-100
										"
						type="button"
						aria-label="Rate This"
						onClick={onToggleRate}
					>
						Rate This
					</button>
					?
				</div>
			</div>

			<div className="flex items-center gap-2 md:gap-4 lg:gap-6">
				<a
					className=""
					href={ratings?.imdb_url}
					target="_blank"
					rel="noreferrer"
				>
					<dl
						className={`
							${ratings?.imdb_url ? "hover:border-white/[.45] active:border-white/[.45]" : "opacity-60"}
							h-full py-0.5 sm:py-2 px-1 xs:px-2 sm:px-3
							flex flex-col items-center gap-1
							bg-imdb shadow-2xl overflow-hidden rounded-lg
							text-center brightness-[.8] hover:brightness-100
						`}
					>
						<img
							className="block h-4 md:h-6 object-contain"
							src={imdbLogo}
							alt="IMDb Logo"
						/>
						<dd className="text-sm xs:text-lg md:text-2xl font-semibold tracking-tight text-gray-900">
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
							h-full py-1 sm:py-2 px-1 xs:px-2 sm:px-3
							flex flex-col items-center gap-0.5 sm:gap-2
							bg-metacritic shadow-2xl overflow-hidden rounded-lg
							text-center brightness-[.8] hover:brightness-100
						`}
					>
						<img
							className="hidden xs:block h-5 md:h-7 object-contain"
							src={metacriticLogo}
							alt="Metacritic Logo"
						/>
						<img
							className="block xs:hidden h-5 md:h-7 object-contain"
							src={metacriticLogoIcon}
							alt="Metacritic Logo"
						/>
						<dd className="flex gap-1 xs:gap-2 text-sm xs:text-lg md:text-2xl font-semibold tracking-tight text-gray-100">
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
							h-full py-1 sm:py-2 px-1 xs:px-2 sm:px-3
							flex flex-col items-center gap-0.5 sm:gap-2
							bg-rotten shadow-2xl overflow-hidden rounded-lg
							text-center brightness-[0.8] hover:brightness-100
						`}
					>
						<img
							className="hidden xs:block h-4 md:h-6 object-contain"
							src={rottenLogo}
							alt="Rotten Tomatoes Logo"
						/>
						<img
							className="block xs:hidden h-5 object-contain"
							src={rottenLogoIcon}
							alt="Rotten Tomatoes Logo"
						/>
						<dd className="flex gap-1 xs:gap-2 text-sm xs:text-lg md:text-2xl font-semibold tracking-tight text-gray-50">
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
