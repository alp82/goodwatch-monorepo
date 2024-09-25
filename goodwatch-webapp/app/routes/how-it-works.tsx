import type { MetaFunction } from "@remix-run/node"
import React from "react"
import disneyLogo from "~/img/disneyplus-logo.svg"
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
				<div className="mt-12 text-lg lg:text-2xl text-gray-300 sm:max-w-md lg:max-w-none">
					<h1 className="font-bold tracking-tight text-gray-100 text-2xl sm:text-3xl md:text-4xl lg:text-5xl">
						How it works
					</h1>
					<div className="leading-relaxed text-md sm:text-lg md:text-xl lg:text-2xl">
						<p className="mt-12">
							Discover great titles on your preferred streaming providers like
							<span className="mx-3 inline-flex items-center flex-wrap gap-2">
								<img
									className="h-5 inline-block"
									src={netflixLogo}
									alt="Netflix"
									title="Netflix"
								/>
								,
								<img
									className="h-6 inline-block"
									src={primeLogo}
									alt="Amazon Prime"
									title="Amazon Prime"
								/>
								and
								<img
									className="h-8 inline-block"
									src={disneyLogo}
									alt="Disney+"
									title="Disney+"
								/>
								.
							</span>
						</p>
						<p className="mt-12">
							See all scores from
							<span className="mx-3 inline-flex items-center flex-wrap gap-2">
								<img
									className="h-5 inline-block"
									src={imdbLogo}
									alt="IMDb"
									title="IMDb"
								/>
								,
								<img
									className="h-5 inline-block"
									src={metacriticLogo}
									alt="Metacritic"
									title="Metacritic"
								/>
								and
								<img
									className="h-5 inline-block"
									src={rottenLogo}
									alt="Rotten Tomatoes"
									title="Rotten Tomatoes"
								/>
							</span>
							combined.
						</p>
						<p className="mt-12 font-bold">It's all here.</p>
					</div>
				</div>
			</div>
		</div>
	)
}
