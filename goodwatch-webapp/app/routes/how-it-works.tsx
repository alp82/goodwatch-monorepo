import type { MetaFunction } from "@remix-run/node"
import React from "react"
import disneyLogo from "~/img/disneyplus-logo.svg"
import huluLogo from "~/img/hulu-logo.png"
import imdbLogo from "~/img/imdb-logo-250.png"
import metacriticLogo from "~/img/metacritic-logo-250.png"
import netflixLogo from "~/img/netflix-logo.svg"
import primeLogo from "~/img/primevideo-logo.svg"
import rottenLogo from "~/img/rotten-logo-250.png"
import type { loader } from "~/routes/discover"

export function headers() {
	return {
		"Cache-Control":
			"max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400",
	}
}

export const meta: MetaFunction<typeof loader> = () => {
	return [
		{ title: "Privacy | GoodWatch" },
		{
			description:
				"Privacy at GoodWatch. All movie and tv show ratings and streaming providers on the same page",
		},
	]
}

export default function About() {
	return (
		<div className="max-w-7x mx-auto px-8 lmt-0 py-2 md:py-4 lg:py-8">
			<div className="mx-auto max-w-7xl px-6 pb-32 lg:px-8">
				<div className="text-lg lg:text-2xl text-gray-300">
					<h1 className="my-12 font-bold tracking-tight text-center text-gray-100 text-2xl sm:text-3xl md:text-4xl lg:text-5xl">
						How it works
					</h1>
					<hr className="border-gray-700" />
					<div className="mt-16 sm:mt-36 flex flex-col gap-16 sm:gap-36 leading-relaxed text-2xl sm:text-3xl lg:text-4xl">
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
					</div>
				</div>
			</div>
		</div>
	)
}
