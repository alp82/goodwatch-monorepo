import React, {useEffect, useState} from 'react'
import Ratings, { RatingsProps } from '~/ui/Ratings'
import InfoBox from '~/ui/InfoBox'
import { useFetcher, useParams } from '@remix-run/react'
import Providers from '~/ui/Providers'
import { MetaFunction } from '@remix-run/node'
import YouTube from 'react-youtube'
import Genres from '~/ui/Genres'
import Keywords from '~/ui/Keywords'
import AgeRating from '~/ui/AgeRating'
import {ReleaseDatesResult, VideoResult} from '~/server/details.server'
import Description from '~/ui/Description'
import Videos from "~/ui/Videos";

export const meta: MetaFunction = () => {
  return {
    title: 'flickvibe',
    description: 'All movie and tv show ratings and streaming providers on the same page',
  }
}

export default function TVDetails() {
  const { tvKey = '' } = useParams()
  const tvId = tvKey.split('-')[0]
  const detailsFetcher = useFetcher()
  const ratingsFetcher = useFetcher()
  const ratingsSeasonsFetcher = useFetcher()

  useEffect(() => {
    detailsFetcher.submit(
      { tvId },
      {
        method: 'get',
        action: '/api/details/tv',
      }
    )
    ratingsFetcher.submit(
      { tvId },
      {
        method: 'get',
        action: '/api/ratings/tv',
      }
    )
    ratingsSeasonsFetcher.submit(
      { tvId },
      {
        method: 'get',
        action: '/api/ratings/tv-seasons',
      }
    )
  }, [tvId])

  const details = detailsFetcher.data?.details || {}
  const ratings: RatingsProps = ratingsFetcher.data?.ratings || {}
  const ratingsSeasons: RatingsProps[] = ratingsSeasonsFetcher.data?.ratings
  const providers = details['watch/providers'] || {}
  console.log({ details })
  console.log({ ratingsSeasons })

  const [showSeasonRatings, setShowSeasonRatings] = useState(false)
  const handleToggleShowSeasonRatings = () => {
    setShowSeasonRatings(value => !value)
  }

  const { backdrop_path, content_ratings, genres, keywords, name, overview, poster_path, tagline, videos, year } = details
  const countryCode = 'DE'
  const ageRating = (content_ratings?.results || []).find((result: ReleaseDatesResult) => result.iso_3166_1 === countryCode)

  const mainInfo = (
    <>
      <Ratings {...ratings} />
      {ratingsSeasons && ratingsSeasons.length > 1 && <div className="mt-2 ml-4">
        <a onClick={handleToggleShowSeasonRatings} className="text-lg underline bold cursor-pointer hover:text-indigo-100 hover:bg-indigo-900">
          {showSeasonRatings ? 'Hide' : 'Show'} Ratings for {ratingsSeasons.length} Seasons
        </a>
        {showSeasonRatings && ratingsSeasons.map((ratingsSeason, index) => (
          <Ratings key={index} {...ratingsSeason} title={`Season ${index+1}`} compact={true} />
        ))}
      </div>}
      <Providers providers={providers} />
      <Videos results={videos?.results || []} />
      <Keywords keywords={keywords} type="tv" />
    </>
  )

  return (
    <div className="mt-8">
      {detailsFetcher.state === 'idle' ?
        <>
          <div className="relative p-3 flex lg:h-96 bg-cover before:absolute before:top-0 before:bottom-0 before:right-0 before:left-0 before:bg-black/[.78]" style={{backgroundImage: `url('https://www.themoviedb.org/t/p/w1920_and_h800_multi_faces/${backdrop_path}')`}}>
            <div className="relative flex-none w-32 lg:w-60">
              <img
                className="block"
                src={`https://www.themoviedb.org/t/p/w300_and_h450_bestv2${poster_path}`}
                alt={`Poster for ${name}`}
                title={`Poster for ${name}`}
              />
            </div>
            <div className="relative flex-1 pl-4">
              <h2 className="mb-2 text-2xl">
                <span className="text-3xl font-bold pr-2">{name}</span> ({year})
              </h2>
              <div className="flex gap-4">
                <AgeRating ageRating={ageRating} />
                <Genres genres={genres} type="tv" />
              </div>
              {tagline && <div className="mb-4">
                  <blockquote className="relative border-l-4 border-gray-700 pl-4 sm:pl-6">
                      <p className="text-white italic sm:text-xl">
                        {tagline}
                      </p>
                  </blockquote>
              </div>}
              <Description description={overview} />
              <div className="hidden lg:block">
                {mainInfo}
              </div>
            </div>
          </div>
          <div className="block lg:hidden">
            {mainInfo}
          </div>
        </>
      :
        <InfoBox text="Inititalizing tv show data..." />
      }
    </div>
  )
}
