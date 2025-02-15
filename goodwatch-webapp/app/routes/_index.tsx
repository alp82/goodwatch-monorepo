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
import { Link, useLoaderData } from "@remix-run/react"
import {
	type DehydratedState,
	QueryClient,
	dehydrate,
} from "@tanstack/react-query"
import React, { useState } from "react"
import { Autoplay, EffectCoverflow, FreeMode } from "swiper/modules"
import { Swiper, SwiperSlide } from "swiper/react"
import startBackground from "~/img/start-background.webp"
import startForeground from "~/img/start-foreground.webp"
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

import "swiper/css"
import "swiper/css/effect-coverflow"
import RemoteControl from "~/ui/start/RemoteControl"
import { type PageItem, type PageMeta, buildMeta } from "~/utils/meta"

export const headers: HeadersFunction = () => {
	return {
		"Cache-Control":
			"max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400",
	}
}

export const meta: MetaFunction<typeof loader> = () => {
	const pageMeta: PageMeta = {
		title: "GoodWatch - Find the best movies and tv shows to watch",
		description:
			"Discover the best movies and tv shows to watch right now. From award-winning Netflix exclusives to classic films on Prime Video, Disney+ and HBO. Find titles by genre, mood, or streaming service. Get personalized recommendations based on ratings from IMDb, Rotten Tomatoes, and Metacritic. Updated daily with new releases and trending titles.",
		url: "https://goodwatch.app",
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "Find your next binge by genre, mood, or streaming service on GoodWatch",
	}

	// TODO
	const items: PageItem[] = []

	return buildMeta({ pageMeta, items })
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

	const [popularPicksType, setPopularPicksType] = useState<"movies" | "tv">(
		"movies",
	)
	const selectPopularMovies = () => {
		setPopularPicksType("movies")
	}
	const selectPopularTV = () => {
		setPopularPicksType("tv")
	}
	const popularPicks =
		popularPicksType === "movies" ? popularPicksMovies : popularPicksTV

	return (
		<>
			<div
				className="relative w-full h-screen flex flex-col select-none bg-cover bg-center bg-no-repeat before:absolute before:top-0 before:bottom-0 before:right-0 before:left-0 before:bg-black/[.25]"
				style={{
					backgroundImage: `url('${startBackground}')`,
				}}
			>
				<div className="pb-32 flex flex-col justify-start items-center overflow-hidden z-10 hover:z-30">
					<div className="hidden sm:flex gap-8 sm:gap-16 text-gray-200 text-xl sm:text-2xl md:text-3xl font-bold">
						<button
							type="button"
							className={`mt-8 px-8 py-2 inline-block border-2 rounded-md border-gray-900 ${popularPicksType === "movies" ? "bg-indigo-900/60" : "bg-slate-900/70"} hover:bg-indigo-800 shadow-[0_0_10px_0_rgba(0,0,0,0.5)]`}
							onClick={selectPopularMovies}
						>
							Good Movies
						</button>
						<button
							type="button"
							className={`mt-8 px-8 py-2 inline-block border-2 rounded-md border-gray-900 ${popularPicksType === "tv" ? "bg-indigo-900/70" : "bg-slate-900/60"} hover:bg-indigo-800 shadow-[0_0_10px_0_rgba(0,0,0,0.5)]`}
							onClick={selectPopularTV}
						>
							Good Shows
						</button>
					</div>

					<div className="my-12 w-full">
						<Swiper
							autoplay={{
								delay: 5000,
								pauseOnMouseEnter: true,
							}}
							breakpoints={{
								"@0.50": {
									slidesPerView: 3,
								},
								"@1.00": {
									slidesPerView: 5,
								},
								"@1.50": {
									slidesPerView: 7,
								},
								"@2.00": {
									slidesPerView: 9,
								},
								"@2.50": {
									slidesPerView: 11,
								},
							}}
							centeredSlides={true}
							coverflowEffect={{
								rotate: 10,
								stretch: 0,
								depth: 100,
								modifier: 1,
								slideShadows: false,
							}}
							effect="coverflow"
							freeMode={{
								enabled: true,
							}}
							grabCursor={true}
							loop={true}
							modules={[Autoplay, EffectCoverflow, FreeMode]}
							// preventClicks={false}
							// preventClicksPropagation={false}
							slidesPerView={3}
						>
							{popularPicks.map((details) => (
								<SwiperSlide key={details.tmdb_id}>
									<div className="w-56 xs:w-64 sm:w-72 md:w-80 lg:w-88 xl:w-96 transition-transform ease-in-out duration-200 hover:rotate-3">
										<MovieTvCard
											details={details}
											mediaType={popularPicksType === "movies" ? "movie" : "tv"}
											prefetch={true}
										/>
									</div>
								</SwiperSlide>
							))}
						</Swiper>
					</div>
				</div>

				<div
					className="absolute bottom-0 left-0 right-0 -ml-24 xl:-ml-44 h-full bg-cover bg-center before:bg-black/[.25] z-20 pointer-events-none"
					style={{
						backgroundImage: `url(${startForeground})`,
					}}
				/>

				{/*<div className="absolute bottom-5 right-16 w-72 z-30">*/}
				{/*	<RemoteControl />*/}
				{/*</div>*/}

				<div className="absolute bottom-0 left-0 right-0 z-30">
					<div className="w-full bg-gradient-to-t from-black/70 to-black/40 sm:from-black/50 sm:to-transparent sm-h:from-black/70 sm-h:to-black/40 ">
						<div className="flex flex-col items-center justify-end gap-4 px-4 pt-8 pb-12 lg-h:pb-40 md:lg-h:pb-52 text-center text-gray-200">
							<h1 className="text-5xl xs:text-6xl sm:text-7xl md:text-8xl lg:text-9xl sm-h:text-6xl font-bold">
								What's Good?
							</h1>
							<p className="mt-6 max-w-2xl leading-relaxed text-xl sm:text-2xl md:text-3xl lg:text-4xl sm-h:text-2xl">
								The only site that understands the{" "}
								<Link
									className="inline-block accent font-bold transition-transform transform duration-300 hover:scale-110"
									to="/how-it-works"
									prefetch="viewport"
								>
									DNA
								</Link>{" "}
								of your favorite movies or shows.
							</p>
							<div className="mt-2 sm:mt-4 md:mt-6 lg:mt-10 flex items-center justify-center flex-wrap gap-4 lg:gap-6 text-xs sm:text-sm md:text-base lg:text-lg font-semibold ">
								<Link
									className="flex items-center justify-center gap-2 p-2 leading-6 text-indigo-400 hover:text-indigo-100 hover:bg-indigo-900"
									to="/how-it-works"
									prefetch="viewport"
								>
									<InformationCircleIcon className="h-5 w-auto" />
									How it works
								</Link>
								<Link
									className="hidden md:flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-md bg-indigo-600 text-sm sm:text-base md:text-lg lg:text-xl text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
									to="/discover"
									prefetch="viewport"
								>
									<CubeIcon className="h-5 w-auto" />
									Discover
								</Link>
								<a
									className="flex items-center justify-center gap-2 p-2 leading-6 text-indigo-400 hover:text-indigo-100 hover:bg-indigo-900"
									href="#trending"
								>
									<ArrowDownIcon className="h-5 w-auto" />
									What's Trending?
								</a>
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
						<Link
							className="flex flex-col text-center justify-center items-center border-dashed border-2 border-indigo-600 hover:bg-indigo-900 hover:border-indigo-900"
							to="/discover/movies"
							prefetch="viewport"
						>
							<FilmIcon className="w-16 h-16" />
							<div className="my-2 px-2">
								<span className="font-bold text-indigo-400">
									Discover more Movies
								</span>
							</div>
						</Link>
					</div>
				)}
				<h2 className="mt-20 mb-4 text-3xl font-bold">Trending TV Shows</h2>
				{trendingTV.length > 0 && (
					<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
						{trendingTV.slice(0, numberOfItemsToShow).map((tv: TrendingTV) => (
							<div key={tv.tmdb_id}>
								<MovieTvCard details={tv} mediaType="tv" prefetch={true} />
							</div>
						))}
						<Link
							className="flex flex-col text-center justify-center items-center border-dashed border-2 border-indigo-600 hover:bg-indigo-900 hover:border-indigo-900"
							to="/discover/tv"
							prefetch="viewport"
						>
							<TvIcon className="w-16 h-16" />
							<div className="my-2 px-2">
								<span className="font-bold text-indigo-400">
									Discover more TV Shows
								</span>
							</div>
						</Link>
					</div>
				)}
			</div>
		</>
	)
}
