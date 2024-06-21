import React, { useState } from "react";
import gwLogo from "~/img/goodwatch-logo.png";
import imdbLogo from "~/img/imdb-logo-250.png";
import metacriticLogo from "~/img/metacritic-logo-250.png";
import metacriticLogoIcon from "~/img/metacritic-logo-icon-250.png";
import rottenLogo from "~/img/rotten-logo-250.png";
import rottenLogoIcon from "~/img/rotten-logo-icon-250.png";
import InfoBox from "~/ui/InfoBox";
import type { AllRatings } from "~/utils/ratings";

export interface RatingBadgesProps {
	ratings?: AllRatings;
	title?: string;
	compact?: boolean;
}

export default function RatingBadges({ ratings }: RatingBadgesProps) {
	const vibeColorIndex = ratings?.aggregated_overall_score_normalized_percent
		? Math.floor(ratings.aggregated_overall_score_normalized_percent / 10) * 10
		: null;

	return (
		<div className="relative">
			<ul className="underline-offset-2 flex flex-wrap gap-2 md:gap-4 lg:gap-6">
				<a>
					<dl
						className={`${ratings?.aggregated_overall_score_normalized_percent ? "" : "opacity-60"} rounded-lg border-4 border-black/[.3] h-full px-1 sm:px-2 ${vibeColorIndex == null ? "bg-gray-700" : `bg-vibe-${vibeColorIndex}`} shadow-2xl overflow-hidden text-center flex items-center gap-1 sm:gap-2`}
					>
						<img
							className="block h-3 md:h-5 object-contain"
							src={gwLogo}
							alt="GoodWatch Logo"
						/>
						<dd
							className={`text-sm md:text-lg font-semibold tracking-tight ${vibeColorIndex == null ? "text-gray-300" : "text-gray-100"}`}
						>
							{ratings?.aggregated_overall_score_normalized_percent
								? Math.floor(
										ratings?.aggregated_overall_score_normalized_percent,
									)
								: "-"}
						</dd>
					</dl>
				</a>

				<a
					className=""
					href={ratings?.imdb_url}
					target="_blank"
					rel="noreferrer"
				>
					<dl
						className={`${ratings?.imdb_url ? "hover:border-white/[.45] active:border-white/[.45]" : "opacity-60"} rounded-lg border-4 border-black/[.3] h-full px-1 sm:px-2 bg-imdb shadow-2xl overflow-hidden text-center flex items-center gap-1 sm:gap-2`}
					>
						<img
							className="block h-4 md:h-6 object-contain"
							src={imdbLogo}
							alt="IMDb Logo"
						/>
						<dd className="text-sm md:text-lg font-semibold tracking-tight text-gray-900">
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
						className={`${ratings?.metacritic_url ? "hover:border-white/[.45] active:border-white/[.45]" : "opacity-60"} rounded-lg border-4 border-white/[.3] h-full px-1 sm:px-2 bg-metacritic shadow-2xl overflow-hidden text-center flex items-center gap-1 sm:gap-2`}
					>
						<img
							className="hidden sm:block h-5 md:h-7 object-contain"
							src={metacriticLogo}
							alt="Metacritic Logo"
						/>
						<img
							className="block sm:hidden h-5 md:h-7 object-contain"
							src={metacriticLogoIcon}
							alt="Metacritic Logo"
						/>
						<dd className="text-sm md:text-lg font-semibold tracking-tight text-gray-100">
							{ratings?.metacritic_meta_score_original
								? Math.floor(ratings?.metacritic_meta_score_original)
								: "–"}
						</dd>
						|
						<dd className="text-sm md:text-lg font-semibold tracking-tight text-gray-100">
							{ratings?.metacritic_user_score_original
								? ratings?.metacritic_user_score_original.toFixed(1)
								: "–"}
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
						className={`${ratings?.rotten_tomatoes_url ? "hover:border-white/[.45] active:border-white/[.45]" : "opacity-60"} rounded-lg border-4 border-black/[.3] h-full px-1 sm:px-2 bg-rotten shadow-2xl overflow-hidden text-center flex items-center gap-1 sm:gap-2`}
					>
						<img
							className="hidden sm:block h-4 md:h-6 object-contain"
							src={rottenLogo}
							alt="Rotten Tomatoes Logo"
						/>
						<img
							className="block sm:hidden h-5 object-contain"
							src={rottenLogoIcon}
							alt="Rotten Tomatoes Logo"
						/>
						<dd className="text-sm md:text-lg font-semibold tracking-tight text-gray-50">
							{ratings?.rotten_tomatoes_tomato_score_original
								? Math.floor(ratings?.rotten_tomatoes_tomato_score_original)
								: "–"}
						</dd>
						|
						<dd className="text-sm md:text-lg font-semibold tracking-tight text-gray-50 no-underline">
							{ratings?.rotten_tomatoes_audience_score_original
								? Math.floor(ratings?.rotten_tomatoes_audience_score_original)
								: "–"}
						</dd>
					</dl>
				</a>
			</ul>
		</div>
	);
}
