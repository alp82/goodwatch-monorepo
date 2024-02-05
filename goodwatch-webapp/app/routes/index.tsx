import React from 'react'
import type { MetaFunction } from '@remix-run/node'
import { json, HeadersFunction, LoaderArgs, LoaderFunction } from '@remix-run/node'
import { PrefetchPageLinks, useLoaderData } from '@remix-run/react'
import { ArrowSmallDownIcon, ArrowUpRightIcon, CubeIcon, FilmIcon, TvIcon } from '@heroicons/react/24/solid'
import imdbLogo from '~/img/imdb-logo-250.png'
import metacriticLogo from '~/img/metacritic-logo-250.png'
import rottenLogo from '~/img/rotten-logo-250.png'
import netflixLogo from '~/img/netflix-logo.svg'
import primeLogo from '~/img/primevideo-logo.svg'
import disneyLogo from '~/img/disneyplus-logo.svg'
import { MovieCard } from '~/ui/MovieCard'
import { MovieDetails, TVDetails } from '~/server/details.server'
import { getTrendingMovies, getTrendingTV } from '~/server/trending.server'
import { TvCard } from '~/ui/TvCard'
import { getPopularPicksMovies, getPopularPicksTV } from '~/server/popular-picks.server'
import { getLocaleFromRequest } from '~/utils/locale'

export const headers: HeadersFunction = () => {
  return {
    "Cache-Control": "max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400",
  };
}

export const meta: MetaFunction = () => {
  return {
    title: 'GoodWatch',
    description: 'What do you want to watch next? All movie and tv show ratings and streaming providers on one page.',
  }
}

type LoaderData = {
  trendingMovies: MovieDetails[]
  trendingTV: TVDetails[]
  popularPicksMovies: MovieDetails[]
  popularPicksTV: TVDetails[]
}

export const loader: LoaderFunction = async ({ params, request }: LoaderArgs) => {
  const { locale } = getLocaleFromRequest(request)
  const apiParams = {
    type: 'default',
    country: locale.country,
    language: locale.language,
  }

  const [
    trendingMovies,
    trendingTV,
    popularPicksMovies,
    popularPicksTV,
  ] = await Promise.all([
    getTrendingMovies(apiParams),
    getTrendingTV(apiParams),
    getPopularPicksMovies(apiParams),
    getPopularPicksTV(apiParams),
  ])

  return json<LoaderData>({
    trendingMovies,
    trendingTV,
    popularPicksMovies,
    popularPicksTV,
  })
}

export default function Index() {
  const {
    trendingMovies,
    trendingTV,
    popularPicksMovies,
    popularPicksTV,
  } = useLoaderData<LoaderData>()
  const numberOfItemsToShow = 11

  // console.log(trendingMovies.map((a) => a.popularity).sort())
  // console.log(trendingTV.map((a) => a.popularity).sort())
  // console.log(popularPicksMovies.map((a) => a.popularity).sort())
  // console.log(popularPicksTV.map((a) => a.popularity).sort())

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
            <path
              d="M-200 200h201v201h-201Z M600 0h201v201h-201Z M-400 400h201v201h-201Z M200 800h201v201h-201Z"
              strokeWidth={0}
            />
          </svg>
          <rect width="100%" height="100%" strokeWidth={0} fill="url(#1f932ae7-37de-4c0a-a8b0-a6e3b4d44b84)" />
        </svg>
        <div
          className="absolute left-1/2 right-0 top-0 -z-10 -ml-24 transform-gpu overflow-hidden blur-3xl lg:ml-24 xl:ml-48"
          aria-hidden="true"
        >
          <div
            className="aspect-[801/1036] w-[50.0625rem] bg-gradient-to-tr from-[#8c17b6] to-[#9089fc] opacity-30"
            style={{
              clipPath:
                'polygon(63.1% 29.5%, 100% 17.1%, 76.6% 3%, 48.4% 0%, 44.6% 4.7%, 54.5% 25.3%, 59.8% 49%, 55.2% 57.8%, 44.4% 57.2%, 27.8% 47.9%, 35.1% 81.5%, 0% 97.7%, 39.2% 100%, 35.2% 81.4%, 97.2% 52.8%, 63.1% 29.5%)',
            }}
          />
        </div>
        <div className="overflow-hidden">
          <div className="mx-auto max-w-7xl px-6 pb-32 pt-8 lg:px-8 lg:pt-32">
            <div className="mx-auto max-w-2xl gap-x-14 lg:mx-0 lg:flex lg:max-w-none lg:items-center">
              <div className="relative w-full max-w-xl lg:shrink-0 xl:max-w-2xl">
                <h1 className="text-4xl font-bold tracking-tight text-gray-100 sm:text-6xl">
                  What do you want to watch next?
                </h1>
                <div className="mt-14 lg:mt-20 text-lg lg:text-2xl text-gray-300 sm:max-w-md lg:max-w-none">
                  <p className="leading-relaxed">
                    Welcome to GoodWatch. You'll find <span className="accent font-bold">everything</span> you need to know about your next favorite movie or TV show.
                  </p>
                  <div className="mt-12 flex items-center gap-x-6">
                    <a
                      href="/discover"
                      className="rounded-md bg-indigo-600 px-3.5 py-2.5 flex items-center justify-center gap-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                      <CubeIcon className="h-5 w-auto" />
                      Discover
                    </a>
                    <a href="#trending" className="flex items-center justify-center gap-2 text-lg font-semibold leading-6 text-indigo-400 hover:text-indigo-100 hover:bg-indigo-900">
                      <ArrowSmallDownIcon className="h-5 w-auto" />
                      What's Trending?
                    </a>
                  </div>
              </div>
                <div className="mt-24 lg:mt-32 text-lg lg:text-2xl text-gray-300 sm:max-w-md lg:max-w-none">
                  <h2 className="text-3xl font-bold tracking-tight text-gray-100 sm:text-4xl">
                    How it works
                  </h2>
                  <p className="mt-12 leading-relaxed">
                    Discover great titles on your preferred streaming providers like
                    <span className="mx-3 inline-flex flex-wrap gap-2">
                      <span><img className="h-5 inline-block" src={netflixLogo} alt="Netflix Logo"
                                 title="Netflix Logo"/> ,</span>
                      <span><img className="h-8 mt-1 inline-block" src={primeLogo} alt="Amazon Prime Logo"
                                 title="Amazon Prime Logo"/></span>
                      <span>and</span>
                      <span><img className="h-10 -mt-3 inline-block" src={disneyLogo} alt="Disney+ Logo"
                                 title="Disney+ Logo"/></span>
                    </span>
                  </p>
                  <p className="mt-12 leading-relaxed">
                    See all scores from
                    <span className="mx-3 inline-flex flex-wrap gap-2">
                      <span><img className="h-5 inline-block" src={imdbLogo} alt="IMDb Logo"
                                 title="IMDb Logo"/> ,</span>
                      <span><img className="h-6 inline-block" src={metacriticLogo} alt="Metacritic Logo"
                                 title="Metacritic Logo"/></span>
                      <span>and</span>
                      <span><img className="h-5 inline-block" src={rottenLogo} alt="Rotten Tomatoes Logo"
                                 title="Rotten Tomatoes Logo"/></span>
                    </span>
                    combined.
                  </p>
                  <p className="mt-12 leading-relaxed font-bold">
                    It's all here.
                  </p>
                </div>
              </div>
              <div
                className="hidden lg:flex mt-14 justify-end gap-8 sm:-mt-44 sm:justify-start sm:pl-20 lg:mt-0 lg:pl-0">
                {/*<div className="ml-auto w-44 flex-none space-y-8 pt-32 sm:ml-0 sm:pt-80 lg:order-last lg:pt-36 xl:order-none xl:pt-80">*/}
                {/*  <MovieCard movie={bestRatedMovies[0]} />*/}
                {/*  <MovieCard movie={bestRatedMovies[2]} />*/}
                {/*  <MovieCard movie={bestRatedMovies[4]} />*/}
                {/*</div>*/}
                <div className="mr-auto w-44 flex-none space-y-8 sm:mr-0 sm:pt-52 lg:pt-36">
                  <TvCard tv={popularPicksTV[0]} />
                  <TvCard tv={popularPicksTV[2]} />
                  <TvCard tv={popularPicksTV[1]} />
                </div>
                <div className="w-44 flex-none space-y-8 pt-32 sm:pt-0">
                  <MovieCard movie={popularPicksMovies[2]} />
                  <MovieCard movie={popularPicksMovies[0]} />
                  <MovieCard movie={popularPicksMovies[1]} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <h2 id="trending" className="mt-12 mb-4 text-3xl font-bold">Trending Movies</h2>
      {trendingMovies.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {trendingMovies.slice(0, numberOfItemsToShow).map((movie: MovieDetails) => (
            <div key={movie.tmdb_id}>
              <MovieCard movie={movie} prefetch={true} />
            </div>
          ))}
          <a className="flex flex-col text-center justify-center items-center w-36 border-dashed border-2 border-indigo-600 hover:bg-indigo-900 hover:border-indigo-900" href="/discover?type=movie">
            <FilmIcon className="w-16 h-16" />
            <div className="my-2 px-2">
              <span className="font-bold text-indigo-400">Discover more Movies</span>
            </div>
          </a>
        </div>
      )}
      <h2 className="mt-12 mb-4 text-3xl font-bold">Trending TV Shows</h2>
      {trendingTV.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {trendingTV.slice(0, numberOfItemsToShow).map((tv: TVDetails) => (
            <div key={tv.tmdb_id}>
              <TvCard tv={tv} prefetch={true} />
            </div>
          ))}
          <a className="flex flex-col text-center justify-center items-center w-36 border-dashed border-2 border-indigo-600 hover:bg-indigo-900 hover:border-indigo-900" href="/discover?type=tv">
            <TvIcon className="w-16 h-16" />
            <div className="my-2 px-2">
              <span className="font-bold text-indigo-400">Discover more TV Shows</span>
            </div>
          </a>
        </div>
      )}
    </div>
  );
}
