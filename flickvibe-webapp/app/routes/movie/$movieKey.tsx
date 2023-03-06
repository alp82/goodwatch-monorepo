import React, { useEffect } from 'react'
import Ratings, { RatingsProps } from '~/ui/Ratings'
import InfoBox from '~/ui/InfoBox'
import { useFetcher, useParams } from '@remix-run/react'
import Providers from '~/ui/Providers'
import { MetaFunction } from '@remix-run/node'

export const meta: MetaFunction = () => {
  return {
    title: 'flickvibe',
    description: 'All movie and tv show ratings and streaming providers on the same page',
  }
}

export default function MovieDetails() {
  const { movieKey = '' } = useParams()
  const movieId = movieKey.split('-')[0]
  const fetcher = useFetcher()

  useEffect(() => {
    fetcher.submit(
      { movieId },
      {
        method: 'get',
        action: '/api/ratings/movie',
      }
    )
  }, [movieId])
  console.log(fetcher.data)

  const details = fetcher.data?.details || {}
  const ratings: RatingsProps = fetcher.data?.ratings || {}
  const providers = details['watch/providers'] || {}

  const { title, poster_path } = details

  return (
    <div className="flex">
      {fetcher.state === 'idle' ?
        <>
          <div className="flex-none w-24 sm:w-64">
            <img
              className="block"
              src={`https://www.themoviedb.org/t/p/w300_and_h450_bestv2${poster_path}`}
              alt={`Poster for ${title}`}
              title={`Poster for ${title}`}
            />
          </div>
          <div className="flex-1 pl-4">
            <h2 className="mb-6 text-2xl font-bold">{title}</h2>
            <div className="">
              <Ratings {...ratings} />
              <Providers providers={providers} />
            </div>
          </div>
        </>
      :
        <InfoBox text="Inititalizing movie data..." />
      }
    </div>
  )
}
