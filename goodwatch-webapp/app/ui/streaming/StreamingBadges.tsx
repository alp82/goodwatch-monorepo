import React from "react";
import tmdb_logo from "~/img/tmdb-logo.svg";
import type { StreamingLink } from "~/server/details.server";
import { useDetailsTab, useTabLink } from "~/utils/navigation";

export interface StreamingBadgesProps {
	links: StreamingLink[];
	countryCodes: string[];
}

export default function StreamingBadges({
	links = [],
	countryCodes = [],
}: StreamingBadgesProps) {
	const { handleStreamingTab } = useDetailsTab();

	const flatrateLinks = links.filter(
		(link: StreamingLink) => link.stream_type == "flatrate",
	);
	const buyLinks = links.filter(
		(link: StreamingLink) => link.stream_type == "buy",
	);

	const PoweredBy = () => {
		return (
			<>
				<div className="mt-6 h-3 flex gap-2 items-center">
					<small>streaming data from</small>
					<a
						href={
							links.length ? links[0].tmdb_url : "https://www.themoviedb.org/"
						}
						target="_blank"
						className=""
						rel="noreferrer"
					>
						<img alt="TMDB" className="h-2 w-auto" src={tmdb_logo} />
					</a>
					<small>and</small>
					<a
						href="https://justwatch.com"
						target="_blank"
						className="ml-0.5 scale-105"
						data-original="https://www.justwatch.com"
						rel="noreferrer"
					>
						<img
							alt="JustWatch"
							className="h-3 w-16"
							src="https://widget.justwatch.com/assets/JW_logo_color_10px.svg"
						/>
					</a>
				</div>
			</>
		);
	};

	const hasFlatrate = Boolean(flatrateLinks.length);
	const hasBuy = Boolean(buyLinks.length);
	if (!hasFlatrate) {
		return hasBuy ? (
			<div>
				<div className="textsm md:text-lg">
					only available for streaming to{" "}
					<a
						className="text-indigo-400 hover:underline"
						onClick={handleStreamingTab}
					>
						buy or rent
					</a>
				</div>
				<PoweredBy />
			</div>
		) : countryCodes?.length ? (
			<div>
				<div className="textsm md:text-lg">
					only available for streaming in{" "}
					<a
						className="text-indigo-400 hover:underline"
						onClick={handleStreamingTab}
					>
						other countries
					</a>
				</div>
				<PoweredBy />
			</div>
		) : (
			<div className="textsm md:text-lg">not available for streaming yet</div>
		);
	}

	return (
		<>
			<div>
				<div className="flex flex-wrap items-center gap-3 sm:gap-6">
					{flatrateLinks.map((link, index) => {
						return (
							<a
								key={link.display_priority}
								href={link.stream_url}
								target="_blank"
								className="flex items-center gap-2 bg-gray-700 text-sm font-semibold shadow-2xl rounded-xl border-4 border-gray-600 hover:border-gray-500"
								rel="noreferrer"
							>
								<img
									className="w-8 h-8 rounded-lg"
									src={`https://www.themoviedb.org/t/p/original/${link.provider_logo_path}`}
									alt={link.provider_name}
								/>
								<span
									className={`${index < 2 ? "pr-2" : "sm:pr-2 hidden"} sm:block`}
								>
									{link.provider_name}
								</span>
							</a>
						);
					})}
				</div>
				<PoweredBy />
			</div>
		</>
	);
}
