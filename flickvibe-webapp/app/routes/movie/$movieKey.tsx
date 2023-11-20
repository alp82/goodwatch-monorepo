import React, { useEffect } from 'react'
import Ratings, { RatingsProps } from '~/ui/Ratings'
import InfoBox from '~/ui/InfoBox'
import { useFetcher, useParams } from '@remix-run/react'
import Providers from '~/ui/Providers'
import { MetaFunction } from '@remix-run/node'
import YouTube from 'react-youtube'
import {Genre, ReleaseDate, ReleaseDatesResult, VideoResult} from '~/server/details.server'
import Keywords from '~/ui/Keywords'
import Genres from '~/ui/Genres'
import AgeRating from '~/ui/AgeRating'
import Description from '~/ui/Description'
import Tabs from "~/ui/Tabs";
import Videos from "~/ui/Videos";
import {titleToDashed} from "~/utils/helpers";
import Collection from "~/ui/Collection";
import Runtime from "~/ui/Runtime";
import { extractRatings } from '~/utils/ratings'

export const meta: MetaFunction = () => {
  return {
    title: 'flickvibe',
    description: 'All movie and tv show ratings and streaming providers on the same page',
  }
}

export default function MovieDetails() {
  const { movieKey = '' } = useParams()
  const movieId = movieKey.split('-')[0]
  const detailsFetcher = useFetcher()

  useEffect(() => {
    detailsFetcher.submit(
      { movieId },
      {
        method: 'get',
        action: '/api/details/movie',
      }
    )
  }, [movieId])

  const details = detailsFetcher.data?.details || {}
  const ratings = extractRatings(details)
  console.log({ details })

  const { backdrop_path, certifications, collection, keywords, genres = [], original_title, poster_path, release_year, runtime, streaming_providers, synopsis, tagline, title, videos } = details
  const ageRating = (certifications || []).length > 0 ? certifications.find((release: ReleaseDate) => release.certification) : null

  const mainInfo = (
    <>
      <Ratings ratings={ratings} />
      <Providers providers={streaming_providers} />
      <Collection collection={collection} movieId={details.id} />
      <Videos videos={videos || []} />
      <Keywords keywords={keywords} type="movie" />
    </>
  )

  return (
    <div className="mt-8">
      {detailsFetcher.state === 'idle' ?
        <>
          <div className="relative p-3 flex lg:h-96 bg-cover before:absolute before:top-0 before:bottom-0 before:right-0 before:left-0 before:bg-black/[.78]" style={{backgroundImage: `url('https://www.themoviedb.org/t/p/w1920_and_h800_multi_faces/${backdrop_path}')`}}>
            <div className="relative flex-none w-32 lg:w-60">
              <img
                className="block rounded-md"
                src={`https://www.themoviedb.org/t/p/w300_and_h450_bestv2${poster_path}`}
                alt={`Poster for ${title}`}
                title={`Poster for ${title}`}
              />
            </div>
            <div className="relative flex-1 pl-4">
              <h2 className="mb-2 text-2xl">
                <span className="text-3xl font-bold pr-2">{title}</span> ({release_year})
              </h2>
              <div className="flex gap-4">
                <AgeRating ageRating={ageRating} />
                <Genres genres={genres} type="movie" />
                <div className="ml-1 mt-1">
                  <Runtime minutes={runtime} />
                </div>
              </div>
              {tagline && <div className="mb-4">
                <blockquote className="relative border-l-4 border-gray-700 pl-4 sm:pl-6">
                  <p className="text-white italic sm:text-xl">
                    {tagline}
                  </p>
                </blockquote>
              </div>}
              <Description description={synopsis} />
            </div>
          </div>
          <div className="hidden lg:block">
            {mainInfo}
          </div>
          <div className="block lg:hidden">
            {mainInfo}
          </div>
        </>
      :
        <InfoBox text="Inititalizing movie data..." />
      }
    </div>
  )
}
