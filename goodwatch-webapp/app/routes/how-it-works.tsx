import { CubeIcon } from "@heroicons/react/24/solid"
import type { MetaFunction } from "@remix-run/node"
import React, { useState } from "react"
import disneyLogo from "~/img/disneyplus-logo.svg"
import dnaBig from "~/img/dna-big.png"
import huluLogo from "~/img/hulu-logo.png"
import imdbLogo from "~/img/imdb-logo-250.png"
import metacriticLogo from "~/img/metacritic-logo-250.png"
import netflixLogo from "~/img/netflix-logo.svg"
import primeLogo from "~/img/primevideo-logo.svg"
import rottenLogo from "~/img/rotten-logo-250.png"
import type { loader } from "~/routes/discover"
import { useInfoModal } from "~/ui/modal/infoModal"

export function headers() {
	return {
		"Cache-Control":
			"max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400",
	}
}

export const meta: MetaFunction<typeof loader> = () => {
	return [
		{ title: "How It Works | GoodWatch" },
		{
			description:
				"Privacy at GoodWatch. All movie and tv show ratings and streaming providers on the same page",
		},
	]
}

export default function About() {
	const { ref, isOpen, position, toggleModal } = useInfoModal()

	return (
		<div className="max-w-7x mx-auto px-8 lmt-0 py-2 md:py-4 lg:py-8">
			<div className="mx-auto max-w-7xl px-6 pb-32 lg:px-8">
				<div className="text-lg lg:text-2xl text-gray-300">
					<h1 className="my-12 font-bold tracking-tight text-center text-gray-100 text-2xl sm:text-3xl md:text-4xl lg:text-5xl">
						How it works
					</h1>

					<hr className="border-gray-700" />

					<div className="mt-16 sm:mt-24 flex flex-col gap-16 sm:gap-24 leading-relaxed text-2xl sm:text-3xl lg:text-4xl">
						<div className="flex items-center justify-center flex-wrap gap-8">
							<p className="max-w-lg text-center">
								Only on GoodWatch: The <span className="accent">DNA</span>{" "}
								classifies movies and shows based on{" "}
								<button
									type="button"
									ref={ref}
									onClick={toggleModal}
									className="text-blue-500 underline hover:text-blue-700 focus:outline-none"
								>
									18 categories
								</button>
								, for example <strong>Mood</strong>, <strong>Plot</strong>,{" "}
								<strong>Dialogs</strong> or <strong>Cinematic Style</strong>
							</p>
							<div className="w-[10em] flex items-center justify-center flex-wrap gap-10">
								<img
									className="h-28 sm:h-40 inline-block"
									src={dnaBig}
									alt="DNA Logo"
									title="DNA Logo"
								/>
							</div>
						</div>

						{isOpen && (
							<div
								style={{ top: `${position.top}px`, left: `${position.left}px` }}
								className="absolute p-4 bg-gray-950 text-lg text-white rounded-lg shadow-lg max-w-sm"
							>
								<h3 className="text-lg font-bold mb-2">
									All 18 DNA categories
								</h3>
								<p className="text-sm">
									Movies and shows are classified into categories:
									<ul className="list-disc pl-6 mt-2">
										<li>Sub-Genres</li>
										<li>Mood</li>
										<li>Themes</li>
										<li>Plot</li>
										<li>Cultural Impact</li>
										<li>Character Types</li>
										<li>Dialog</li>
										<li>Narrative</li>
										<li>Humor</li>
										<li>Pacing</li>
										<li>Time</li>
										<li>Place</li>
										<li>Cinematic Style</li>
										<li>Score and Sound</li>
										<li>Costume and Set</li>
										<li>Key Props</li>
										<li>Target Audience</li>
										<li>Flag</li>
									</ul>
								</p>
								<button
									type="button"
									onClick={toggleModal}
									className="mt-2 text-sm text-indigo-300 underline hover:text-indigo-200"
								>
									Close
								</button>
							</div>
						)}

						<hr className="border-gray-700" />

						<div className="flex items-center justify-center flex-wrap gap-16 md:gap-36">
							<div className="flex flex-col gap-10">
								<div className="w-[10em] flex items-center justify-center gap-10">
									<img
										className="h-5 sm:h-10 mt-8inline-block"
										src={netflixLogo}
										alt="Netflix"
										title="Netflix"
									/>
									<img
										className="h-6 sm:h-12 inline-block"
										src={primeLogo}
										alt="Amazon Prime"
										title="Amazon Prime"
									/>
								</div>
								<div className="w-[10em] flex items-center justify-center gap-10">
									<img
										className="h-5 sm:h-10 mt-8 ml-8 inline-block"
										src={huluLogo}
										alt="Hulu"
										title="Hulu"
									/>
									<img
										className="h-12 sm:h-20-mt-6 -ml-2 inline-block"
										src={disneyLogo}
										alt="Disney+"
										title="Disney+"
									/>
								</div>
							</div>
							<p className="max-w-sm text-center">
								See <span className="accent">where to watch</span> your next
								favorite movie or TV show.
							</p>
						</div>

						<hr className="border-gray-700" />

						<div className="flex items-center justify-center flex-wrap gap-16">
							<p className="max-w-sm text-center">
								See <span className="accent">all scores</span> from different
								sources.
							</p>
							<div className="w-[10em] flex items-center justify-center flex-wrap gap-10">
								<img
									className="h-12 inline-block"
									src={imdbLogo}
									alt="IMDb"
									title="IMDb"
								/>
								<img
									className="h-12 inline-block"
									src={metacriticLogo}
									alt="Metacritic"
									title="Metacritic"
								/>
								<img
									className="h-12 inline-block"
									src={rottenLogo}
									alt="Rotten Tomatoes"
									title="Rotten Tomatoes"
								/>
							</div>
						</div>

						<hr className="border-gray-700" />

						<div className="flex items-center justify-center flex-wrap gap-16 md:gap-36">
							<a
								href="/discover"
								className="rounded-md bg-indigo-600 px-8 py-4 flex items-center justify-center gap-2 lg:gap-4 text-xl lg:text-2xl text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
							>
								<CubeIcon className="h-5 lg:h-7 w-auto" />
								<span className="hidden xs:inline">Try it: </span>Discover
							</a>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
