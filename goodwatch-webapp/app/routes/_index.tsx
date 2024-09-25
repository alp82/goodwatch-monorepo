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
import startBackground from "~/img/start-background.png"
import startForeground from "~/img/start-foreground.png"
import startImage from "~/img/start-living-room.png"
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
	const { trendingMovies, trendingTV, popularPicksMovies, popularPicksTV } =
		useLoaderData<LoaderData>()
	const numberOfItemsToShow = 11

	return (
		<div>
			<div
				className="relative w-full h-screen flex flex-col bg-gray-700 bg-cover bg-center bg-no-repeat before:absolute before:top-0 before:bottom-0 before:right-0 before:left-0 before:bg-black/[.25]"
				style={{
					backgroundImage: `url('${startBackground}')`,
				}}
			>
				<div className="flex-1 flex justify-center items-start overflow-hidden z-20">
					<div
						className="mt-44 flex gap-16"
						style={{
							minWidth: "fit-content",
						}}
					>
						{/*{popularPicksTV.map((movie) => (*/}
						{popularPicksMovies.map((movie) => (
							<div key={movie.tmdb_id} className="w-64 group">
								<div className="transition-transform duration-300 transform group-hover:scale-110">
									<MovieTvCard details={movie} mediaType="movie" />
								</div>
							</div>
						))}
					</div>
				</div>
				<div
					className="absolute bottom-0 left-0 right-0 -ml-44 h-full bg-cover bg-center pointer-events-none z-20 before:bg-black/[.25]"
					style={{
						backgroundImage: `url(${startForeground})`,
					}}
				>
					<h1 className="absolute bottom-[26%] sm:bottom-[24%] md:bottom-[22%] lg:bottom-[20%] left-44 right-0 text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-bold text-center text-gray-200">
						What's Good?
					</h1>
				</div>
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
									<span className="accent font-bold">everything</span> you need
									to know about your next favorite movie or TV show.
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
										Discover great titles on your preferred streaming providers
										like
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
