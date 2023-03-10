import { MetaFunction } from '@remix-run/node'
import { useFetcher } from '@remix-run/react'
import React, { useEffect } from 'react'
import { PopularMovie, PopularTV } from '~/server/popular.server'
import Ratings from '~/ui/Ratings'
import Providers from '~/ui/Providers'
import YouTube from 'react-youtube'
import { titleToDashed } from '~/utils/helpers'

export const meta: MetaFunction = () => {
  return {
    title: 'flickvibe',
    description: 'All movie and tv show ratings and streaming providers on the same page',
  }
}

export default function Index() {
  const language = 'en'

  const fetcherMovie = useFetcher()
  const fetcherTV = useFetcher()

  useEffect(() => {
    fetcherMovie.submit(
      {
        language,
      },
      {
        method: 'get',
        action: '/api/popular/movie',
      }
    )
    fetcherTV.submit(
      {
        language,
      },
      {
        method: 'get',
        action: '/api/popular/tv',
      }
    )
  }, [])

  const popularMovieResults = fetcherMovie.data?.popular?.results || []
  const popularTVResults = fetcherTV.data?.popular?.results || []

  return (
    <div>
      <div>
        <div className="">Welcome. Search above and select a movie or tv show. You can then check ratings and streaming providers on one page.</div>
      </div>
      <h2 className="my-4 text-3xl font-bold">Popular Movies</h2>
      <div className="flex flex-wrap gap-4">
        {popularMovieResults.map((movie: PopularMovie) => {
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
      </div>
      <h2 className="my-4 text-3xl font-bold">Popular TV Shows</h2>
      <div>
        <div className="flex flex-wrap gap-4">
          {popularTVResults.map((tv: PopularTV) => {
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
        </div>
      </div>
    </div>
  );
}
