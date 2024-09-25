import { InformationCircleIcon } from "@heroicons/react/20/solid"
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
import React, { useState } from "react"
import disneyLogo from "~/img/disneyplus-logo.svg"
import imdbLogo from "~/img/imdb-logo-250.png"
import metacriticLogo from "~/img/metacritic-logo-250.png"
import netflixLogo from "~/img/netflix-logo.svg"
import primeLogo from "~/img/primevideo-logo.svg"
import rottenLogo from "~/img/rotten-logo-250.png"
import startBackground from "~/img/start-background.png"
import startForeground from "~/img/start-foreground.png"
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
import { prefetchUserSettings } from "~/server/user-settings.server"
import { prefetchUserData } from "~/server/userData.server"
import { MovieTvCard } from "~/ui/MovieTvCard"
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

	// prefetch data
	const queryClient = new QueryClient()
	await Promise.all([
		prefetchUserData({ queryClient, request }),
		prefetchUserSettings({ queryClient, request }),
	])

	return json<LoaderData>({
		trendingMovies,
		trendingTV,
		popularPicksMovies,
		popularPicksTV,
		dehydratedState: dehydrate(queryClient),
	})
}

export default function Index() {
	const numberOfItemsToShow = 11

	const { trendingMovies, trendingTV, popularPicksMovies, popularPicksTV } =
		useLoaderData<LoaderData>()

	const [popularPicks, setPopularPicks] = useState<"movies" | "tv">("movies")

	const selectPopularMovies = () => {
		setPopularPicks("movies")
	}
	const selectPopularTV = () => {
		setPopularPicks("tv")
	}

	return (
		<div>
			<div
				className="relative w-full h-screen flex flex-col bg-gray-700 bg-cover bg-center bg-no-repeat before:absolute before:top-0 before:bottom-0 before:right-0 before:left-0 before:bg-black/[.25]"
				style={{
					backgroundImage: `url('${startBackground}')`,
				}}
			>
				<div className="flex flex-col justify-start items-center z-20">
					<div className="flex gap-8 sm:gap-16 text-gray-200 text-xl sm:text-2xl md:text-3xl font-bold">
						<button
							type="button"
							className={`mt-8 px-8 py-2 inline-block border-2 rounded-md border-gray-900 ${popularPicks === "movies" ? "bg-indigo-900" : "bg-slate-950"} hover:bg-indigo-800 shadow-[0_0_10px_0_rgba(0,0,0,0.5)]`}
							onClick={selectPopularMovies}
						>
							Movies
						</button>
						<button
							type="button"
							className={`mt-8 px-8 py-2 inline-block border-2 rounded-md border-gray-900 ${popularPicks === "tv" ? "bg-indigo-900" : "bg-slate-950"} hover:bg-indigo-800 shadow-[0_0_10px_0_rgba(0,0,0,0.5)]`}
							onClick={selectPopularTV}
						>
							Shows
						</button>
					</div>
					<div className="mt-12 flex gap-16">
						{popularPicksMovies.map((details) => (
							<div
								key={details.tmdb_id}
								className={`${popularPicks === "movies" ? "" : "hidden"} w-64 md:w-72 lg:w-80 xl:w-96`}
							>
								<div className="transition-transform duration-200 transform hover:scale-105 hover:rotate-2">
									<MovieTvCard
										details={details}
										mediaType="movie"
										prefetch={true}
									/>
								</div>
							</div>
						))}
						{popularPicksTV.map((details) => (
							<div
								key={details.tmdb_id}
								className={`${popularPicks === "tv" ? "" : "hidden"} w-64 md:w-72 lg:w-80 xl:w-96`}
							>
								<div className="transition-transform duration-200 transform hover:scale-105 hover:rotate-2">
									<MovieTvCard
										details={details}
										mediaType="movie"
										prefetch={true}
									/>
								</div>
							</div>
						))}
					</div>
				</div>
				<div
					className="absolute bottom-0 left-0 right-0 -ml-44 h-full bg-cover bg-center before:bg-black/[.25] z-20 pointer-events-none"
					style={{
						backgroundImage: `url(${startForeground})`,
					}}
				/>
			</div>

			<div className="relative -mt-[30em] pb-[8em] w-full bg-gradient-to-t from-black/70 to-transparent z-30">
				<div className="px-4 text-center text-gray-200">
					<h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-bold">
						What's Good?
					</h1>
					<p className="mt-6 m-auto max-w-2xl leading-relaxed text-xl sm:text-2xl md:text-3xl lg:text-4xl">
						At GoodWatch you'll find{" "}
						<span className="accent font-bold">everything</span> you need to
						know about your next favorite movie or TV show.
					</p>
					<div className="mt-10 flex items-center justify-center flex-wrap gap-6 ">
						<a
							href="/how-it-works"
							className="flex items-center justify-center gap-2 p-2 text-lg font-semibold leading-6 text-indigo-400 hover:text-indigo-100 hover:bg-indigo-900"
						>
							<InformationCircleIcon className="h-5 w-auto" />
							How it works
						</a>
						<a
							href="/discover"
							className="rounded-md bg-indigo-600 px-3.5 py-2.5 flex items-center justify-center gap-2 text-sm lg:text-lg font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
						>
							<CubeIcon className="h-5 w-auto" />
							Discover
						</a>
						<a
							href="#trending"
							className="flex items-center justify-center gap-2 p-2 text-lg font-semibold leading-6 text-indigo-400 hover:text-indigo-100 hover:bg-indigo-900"
						>
							<ArrowDownIcon className="h-5 w-auto" />
							What's Trending?
						</a>
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
									<MovieTvCard
										details={movie}
										mediaType="movie"
										prefetch={true}
									/>
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
								<MovieTvCard details={tv} mediaType="tv" prefetch={true} />
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
