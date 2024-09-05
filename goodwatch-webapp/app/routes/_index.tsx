import {
	ArrowDownIcon,
	CubeIcon,
	FilmIcon,
	TvIcon,
} from "@heroicons/react/24/solid"
import type { MetaFunction } from "@remix-run/node"
import {
	type HeadersFunction,
	type LoaderFunction,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import {
	type DehydratedState,
	QueryClient,
	dehydrate,
} from "@tanstack/react-query"
import React from "react"
import disneyLogo from "~/img/disneyplus-logo.svg"
import imdbLogo from "~/img/imdb-logo-250.png"
import metacriticLogo from "~/img/metacritic-logo-250.png"
import netflixLogo from "~/img/netflix-logo.svg"
import primeLogo from "~/img/primevideo-logo.svg"
import rottenLogo from "~/img/rotten-logo-250.png"
import {
	type PopularPicksMovie,
	type PopularPicksTV,
	getPopularPicksMovies,
	getPopularPicksTV,
} from "~/server/popular-picks.server"
import {
	type TrendingMovie,
	type TrendingTV,
	getTrendingMovies,
	getTrendingTV,
} from "~/server/trending.server"
import { prefetchUserData } from "~/server/userData.server"
import { MovieCard } from "~/ui/MovieCard"
import { TvCard } from "~/ui/TvCard"
import { getLocaleFromRequest } from "~/utils/locale"

export const headers: HeadersFunction = () => {
	return {
		"Cache-Control":
			"max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400",
	}
}

export const meta: MetaFunction<typeof loader> = () => {
	return [
		{ title: "GoodWatch" },
		{
			description:
				"What do you want to watch next? All movie and tv show ratings and streaming providers on one page.",
		},
	]
}

type LoaderData = {
	trendingMovies: TrendingMovie[]
	trendingTV: TrendingTV[]
	popularPicksMovies: PopularPicksMovie[]
	popularPicksTV: PopularPicksTV[]
	dehydratedState: DehydratedState
}

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const { locale } = getLocaleFromRequest(request)
	const apiParams = {
		type: "default",
		country: locale.country,
		language: locale.language,
	}

	const [trendingMovies, trendingTV, popularPicksMovies, popularPicksTV] =
		await Promise.all([
			getTrendingMovies(apiParams),
			getTrendingTV(apiParams),
			getPopularPicksMovies(apiParams),
			getPopularPicksTV(apiParams),
		])

	const queryClient = new QueryClient()
	await prefetchUserData({
		queryClient,
		request,
	})

	return json<LoaderData>({
		trendingMovies,
		trendingTV,
		popularPicksMovies,
		popularPicksTV,
		dehydratedState: dehydrate(queryClient),
	})
}

export default function Index() {
	const { trendingMovies, trendingTV, popularPicksMovies, popularPicksTV } =
		useLoaderData<LoaderData>()
	const numberOfItemsToShow = 11

	return (
		<div>
			<div className="relative isolate">
				<svg
					className="absolute inset-x-0 top-0 -z-10 h-[64rem] w-full stroke-gray-700 [mask-image:radial-gradient(32rem_32rem_at_center,white,transparent)]"
					aria-hidden="true"
				>
					<defs>
						<pattern
							id="1f932ae7-37de-4c0a-a8b0-a6e3b4d44b84"
							width={200}
							height={200}
							x="50%"
							y={-1}
							patternUnits="userSpaceOnUse"
						>
							<path d="M.5 200V.5H200" fill="none" />
						</pattern>
					</defs>
					<svg x="50%" y={-1} className="overflow-visible fill-indigo-950">
						<title>Radial gradient</title>
						<path
							d="M-200 200h201v201h-201Z M600 0h201v201h-201Z M-400 400h201v201h-201Z M200 800h201v201h-201Z"
							strokeWidth={0}
						/>
					</svg>
					<rect
						width="100%"
						height="100%"
						strokeWidth={0}
						fill="url(#1f932ae7-37de-4c0a-a8b0-a6e3b4d44b84)"
					/>
				</svg>
				<div
					className="absolute left-1/2 right-0 top-0 -z-10 -ml-24 transform-gpu overflow-hidden blur-3xl lg:ml-24 xl:ml-48"
					aria-hidden="true"
				>
					<div
						className="aspect-[801/1036] w-[50.0625rem] bg-gradient-to-tr from-[#8c17b6] to-[#9089fc] opacity-30"
						style={{
							clipPath:
								"polygon(63.1% 29.5%, 100% 17.1%, 76.6% 3%, 48.4% 0%, 44.6% 4.7%, 54.5% 25.3%, 59.8% 49%, 55.2% 57.8%, 44.4% 57.2%, 27.8% 47.9%, 35.1% 81.5%, 0% 97.7%, 39.2% 100%, 35.2% 81.4%, 97.2% 52.8%, 63.1% 29.5%)",
						}}
					/>
				</div>
				<div className="overflow-hidden">
					<div className="mx-auto max-w-7xl px-6 pb-32 pt-8 lg:px-8 lg:pt-32">
						<div className="mx-auto max-w-2xl gap-x-14 lg:mx-0 lg:flex lg:max-w-none lg:items-center">
							<div className="relative w-full max-w-xl lg:shrink-0 xl:max-w-2xl">
								<h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-100">
									What do you want to{" "}
									<span className="underline underline-offset-8 decoration-8 decoration-indigo-600">
										watch next
									</span>
									?
								</h1>
								<div className="mt-14 lg:mt-20 text-lg sm:text-xl md:text-2xl lg:text-3xl text-gray-300 sm:max-w-md lg:max-w-none">
									<p className="leading-relaxed">
										Welcome to GoodWatch. You'll find{" "}
										<span className="accent font-bold">everything</span> you
										need to know about your next favorite movie or TV show.
									</p>
									<div className="mt-12 flex items-center gap-x-6">
										<a
											href="/discover"
											className="rounded-md bg-indigo-600 px-3.5 py-2.5 flex items-center justify-center gap-2 text-sm lg:text-lg font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
										>
											<CubeIcon className="h-5 w-auto" />
											Discover
										</a>
										<a
											href="#trending"
											className="flex items-center justify-center gap-2 text-lg font-semibold leading-6 text-indigo-400 hover:text-indigo-100 hover:bg-indigo-900"
										>
											<ArrowDownIcon className="h-5 w-auto" />
											What's Trending?
										</a>
									</div>
								</div>
								<div className="mt-24 lg:mt-32 text-lg lg:text-2xl text-gray-300 sm:max-w-md lg:max-w-none">
									<h2 className="font-bold tracking-tight text-gray-100 text-2xl sm:text-3xl md:text-4xl lg:text-5xl">
										How it works
									</h2>
									<div className="leading-relaxed text-md sm:text-lg md:text-xl lg:text-2xl">
										<p className="mt-12">
											Discover great titles on your preferred streaming
											providers like
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
							<div className="hidden lg:flex justify-end gap-8 sm:justify-start">
								{/*<div className="ml-auto w-44 flex-none space-y-8 pt-32 sm:ml-0 sm:pt-80 lg:order-last lg:pt-36 xl:order-none xl:pt-80">*/}
								{/*  <MovieCard movie={bestRatedMovies[0]} />*/}
								{/*  <MovieCard movie={bestRatedMovies[2]} />*/}
								{/*  <MovieCard movie={bestRatedMovies[4]} />*/}
								{/*</div>*/}
								<div className="mr-auto w-44 flex-none space-y-8 md:mr-0 md:pt-52 lg:pt-36">
									<TvCard tv={popularPicksTV[0]} />
									<TvCard tv={popularPicksTV[2]} />
									<TvCard tv={popularPicksTV[1]} />
								</div>
								<div className="w-44 flex-none space-y-8 pt-32 md:pt-0">
									<MovieCard movie={popularPicksMovies[2]} />
									<MovieCard movie={popularPicksMovies[0]} />
									<MovieCard movie={popularPicksMovies[1]} />
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<a id="trending" />
			<div className="max-w-7xl mx-auto">
				<h2 className="mt-12 mb-4 text-3xl font-bold">Trending Movies</h2>
				{trendingMovies.length > 0 && (
					<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
						{trendingMovies
							.slice(0, numberOfItemsToShow)
							.map((movie: TrendingMovie) => (
								<div key={movie.tmdb_id}>
									<MovieCard movie={movie} prefetch={true} />
								</div>
							))}
						<a
							className="flex flex-col text-center justify-center items-center border-dashed border-2 border-indigo-600 hover:bg-indigo-900 hover:border-indigo-900"
							href="/discover?type=movie"
						>
							<FilmIcon className="w-16 h-16" />
							<div className="my-2 px-2">
								<span className="font-bold text-indigo-400">
									Discover more Movies
								</span>
							</div>
						</a>
					</div>
				)}
				<h2 className="mt-12 mb-4 text-3xl font-bold">Trending TV Shows</h2>
				{trendingTV.length > 0 && (
					<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
						{trendingTV.slice(0, numberOfItemsToShow).map((tv: TrendingTV) => (
							<div key={tv.tmdb_id}>
								<TvCard tv={tv} prefetch={true} />
							</div>
						))}
						<a
							className="flex flex-col text-center justify-center items-center border-dashed border-2 border-indigo-600 hover:bg-indigo-900 hover:border-indigo-900"
							href="/discover?type=tv"
						>
							<TvIcon className="w-16 h-16" />
							<div className="my-2 px-2">
								<span className="font-bold text-indigo-400">
									Discover more TV Shows
								</span>
							</div>
						</a>
					</div>
				)}
			</div>
		</div>
	)
}
