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

export default function TVDetails() {
  const { tvKey = '' } = useParams()
  const tvId = tvKey.split('-')[0]
  const fetcher = useFetcher()

  useEffect(() => {
    fetcher.submit(
      { tvId },
      {
        method: 'get',
        action: '/api/ratings/tv',
      }
    )
  }, [tvId])
  console.log(fetcher.data)

  const details = fetcher.data?.details || {}
  const ratings: RatingsProps = fetcher.data?.ratings || {}
  const providers = details['watch/providers'] || {}

  const { name, backdrop_path, poster_path, first_air_date } = details
  const year = first_air_date?.split('-')?.[0]

  return (
    <div className="mt-8">
      {fetcher.state === 'idle' ?
        <div className="relative p-3 flex h-96 bg-cover before:absolute before:top-0 before:bottom-0 before:right-0 before:left-0 before:bg-black/[.78]" style={{backgroundImage: `url('https://www.themoviedb.org/t/p/w1920_and_h800_multi_faces/${backdrop_path}')`}}>
          <div className="relative flex-none w-24 sm:w-64">
            <img
              className="block"
              src={`https://www.themoviedb.org/t/p/w300_and_h450_bestv2${poster_path}`}
              alt={`Poster for ${name}`}
              title={`Poster for ${name}`}
            />
          </div>
          <div className="relative flex-1 pl-4">
            <h2 className="mb-6 text-2xl">
              <span className="text-3xl font-bold pr-2">{name}</span> ({year})
            </h2>
            <div className="">
              <Ratings {...ratings} />
              <Providers providers={providers} />
            </div>
          </div>
        </div>
      :
        <InfoBox text="Inititalizing tv show data..." />
      }
    </div>
  )
}
