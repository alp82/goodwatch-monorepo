import { MetaFunction } from '@remix-run/node'
import { useFetcher } from '@remix-run/react'
import React, { useEffect } from 'react'
import { PopularMovie, PopularTV } from '~/server/popular.server'
import { titleToDashed } from '~/utils/helpers'
import imdbLogo from '~/img/imdb-logo-250.png'
import metacriticLogo from '~/img/metacritic-logo-250.png'
import rottenLogo from '~/img/rotten-logo-250.png'
import { FilmIcon, RocketLaunchIcon, TvIcon } from '@heroicons/react/24/solid'

export const meta: MetaFunction = () => {
  return {
    title: 'flickvibe',
    description: 'All movie and tv show ratings and streaming providers on the same page',
  }
}

export default function Index() {
  const language = 'en'
  const numberOfItemsToShow = 6

  const fetcherMovie = useFetcher()
  const fetcherTV = useFetcher()

  useEffect(() => {
    fetcherMovie.submit(
      {
        language,
      },
      {
        method: 'get',
        action: '/api/trending/movie',
      }
    )
    fetcherTV.submit(
      {
        language,
      },
      {
        method: 'get',
        action: '/api/trending/tv',
      }
    )
  }, [])

  const trendingMovieResults = fetcherMovie.data?.trending?.results || []
  const trendingTVResults = fetcherTV.data?.trending?.results || []

  return (
    <div>
      <div className="mt-4 mb-8">
        <div className="leading-8 text-lg lg:text-2xl">
          <p className="my-8">
            Welcome to <strong>flickvibe</strong>. Search above and select a movie or tv show. You can then check ratings from
            <span className="mx-4 inline-flex flex-wrap gap-4">
              <span><img className="h-5 inline-block" src={imdbLogo} alt="IMDb Logo" title="IMDb Logo" /> ,</span>
              <span><img className="h-6 inline-block" src={metacriticLogo} alt="Metacritic Logo" title="Metacritic Logo" /></span>
              <span>and</span>
              <span><img className="h-5 inline-block" src={rottenLogo} alt="Rotten Tomatoes Logo" title="Rotten Tomatoes Logo" /></span>
            </span>
            and many streaming providers on the same page.
          </p>
          <p>
            <a href="/discover" className="underline text-indigo-400 hover:text-indigo-100 hover:bg-indigo-900">Discover</a> movies and tv shows with an easy to explore
            search interface.
          </p>
        </div>
      </div>
      <h2 className="mt-12 mb-4 text-3xl font-bold">Trending Movies</h2>
      {trendingMovieResults.length > 0 && <div className="flex flex-wrap gap-4">
        {trendingMovieResults.slice(0, numberOfItemsToShow).map((movie: PopularMovie) => {
          return (
            <a key={movie.id} className="flex flex-col w-36 border-4 border-transparent hover:bg-indigo-900 hover:border-indigo-900" href={`/movie/${movie.id}-${titleToDashed(movie.title)}`}>
              <div>
                <img
                  className="block rounded-md"
                  src={`https://www.themoviedb.org/t/p/w300_and_h450_bestv2${movie.poster_path}`}
                  alt={`Poster for ${movie.title}`}
                  title={`Poster for ${movie.title}`}
                />
              </div>
              <div className="my-2 px-2">
                <span className="text-sm font-bold">{movie.title}</span>
              </div>
            </a>
          )
        })}
        <a className="flex flex-col text-center justify-center items-center w-36 border-dashed border-2 border-indigo-600 hover:bg-indigo-900 hover:border-indigo-900" href="/discover?type=movie">
          <FilmIcon className="w-16 h-16" />
          <div className="my-2 px-2">
            <span className="font-bold text-indigo-400">Discover more Movies</span>
          </div>
        </a>
      </div>}
      <h2 className="mt-12 mb-4 text-3xl font-bold">Trending TV Shows</h2>
      {trendingTVResults.length > 0 && <div>
        <div className="flex flex-wrap gap-4">
          {trendingTVResults.slice(0, numberOfItemsToShow).map((tv: PopularTV) => {
            return (
              <a key={tv.id} className="flex flex-col w-36 border-4 border-transparent hover:bg-indigo-900 hover:border-indigo-900" href={`/tv/${tv.id}-${titleToDashed(tv.name)}`}>
                <div>
                  <img
                    className="block rounded-md"
                    src={`https://www.themoviedb.org/t/p/w300_and_h450_bestv2${tv.poster_path}`}
                    alt={`Poster for ${tv.name}`}
                    title={`Poster for ${tv.name}`}
                  />
                </div>
                <div className="my-2 px-2">
                  <span className="text-sm font-bold">{tv.name}</span>
                </div>
              </a>
            )
          })}
          <a className="flex flex-col text-center justify-center items-center w-36 border-dashed border-2 border-indigo-600 hover:bg-indigo-900 hover:border-indigo-900" href="/discover?type=tv">
            <TvIcon className="w-16 h-16" />
            <div className="my-2 px-2">
              <span className="font-bold text-indigo-400">Discover more TV Shows</span>
            </div>
          </a>
        </div>
      </div>}
    </div>
  );
}
