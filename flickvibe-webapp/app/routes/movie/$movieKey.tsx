import React, { useEffect, useState } from 'react'
import Ratings, { RatingsProps } from '~/ui/Ratings'
import InfoBox from '~/ui/InfoBox'
import { useFetcher, useParams } from '@remix-run/react'
import Streaming from '~/ui/Streaming'
import { MetaFunction } from '@remix-run/node'
import YouTube from 'react-youtube'
import {Genre, ReleaseDate, ReleaseDatesResult, VideoResult} from '~/server/details.server'
import Keywords from '~/ui/Keywords'
import Genres from '~/ui/Genres'
import AgeRating from '~/ui/AgeRating'
import Description from '~/ui/Description'
import Tabs, { Tab } from '~/ui/Tabs'
import Videos from "~/ui/Videos";
import {titleToDashed} from "~/utils/helpers";
import Collection from "~/ui/Collection";
import Runtime from "~/ui/Runtime";
import { extractRatings } from '~/utils/ratings'
import RatingProgressOverlay from '~/ui/RatingProgressOverlay'
import RatingBadges from '~/ui/RatingBadges'
import StreamingBadges from '~/ui/StreamingBadges'

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

  const [selectedTab, setSelectedTab] = useState('details')
  const movieTabs = ['details', 'ratings', 'streaming', 'videos'].map((tab) => {
    return {
      key: tab,
      label: tab.charAt(0).toUpperCase() + tab.slice(1),
      current: tab === selectedTab,
    }
  })
  const handleTabSelection = (tab: Tab) => {
    setSelectedTab(tab.key)
  }

  const mainInfo = (
    <>
      {selectedTab === 'details' && (
        <>
          {tagline && <div className="mb-4">
            <blockquote className="relative border-l-4 border-gray-700 pl-4 sm:pl-6">
              <p className="text-white italic sm:text-xl">
                {tagline}
              </p>
            </blockquote>
          </div>}
          <Description description={synopsis} />
          <Collection collection={collection} movieId={details.id} />
          <Keywords keywords={keywords} type="movie" />
        </>
      )}
      {selectedTab === 'ratings' && (
        <>
          <Ratings ratings={ratings} />
        </>
      )}
      {selectedTab === 'streaming' && (
        <>
          <Streaming providers={streaming_providers} />
        </>
      )}
      {selectedTab === 'videos' && (
        <>
          <Videos videos={videos || []} />
        </>
      )}
    </>
  )

  return (
    <div className="md:mt-4 lg:mt-8">
      {detailsFetcher.state === 'idle' ?
        <>
          <div className="relative mb-2 flex lg:h-96 bg-contain bg-center bg-no-repeat before:absolute before:top-0 before:bottom-0 before:right-0 before:left-0 before:bg-black/[.68]" style={{backgroundImage: `url('https://www.themoviedb.org/t/p/w1920_and_h800_multi_faces/${backdrop_path}')`}}>
            <div className="md:hidden">
              <RatingProgressOverlay ratings={ratings} />
            </div>
            <div className="p-3 flex">
              <div className="hidden md:block relative flex-none w-40 lg:w-60">
                <RatingProgressOverlay ratings={ratings} />
                <img
                  className="block rounded-md"
                  src={`https://www.themoviedb.org/t/p/w300_and_h450_bestv2${poster_path}`}
                  alt={`Poster for ${title}`}
                  title={`Poster for ${title}`}
                />
              </div>
              <div className="relative flex-1 mt-4 md:pl-4 lg:pl-8">
                <h2 className="mb-2 text-2xl">
                  <span className="text-3xl font-bold pr-2">{title}</span> ({release_year})
                </h2>
                <Genres genres={genres} type="movie" />
                <div className="flex gap-4 mb-4">
                  <AgeRating ageRating={ageRating} />
                  <div className="ml-1 mt-1">
                    <Runtime minutes={runtime} />
                  </div>
                </div>
                <div className="mb-4">
                  <RatingBadges ratings={ratings} />
                </div>
                <div className="mb-4">
                  <StreamingBadges providers={streaming_providers} />
                </div>
              </div>
            </div>
          </div>
          <div className="my-4">
            <Tabs tabs={movieTabs} pills={true} onSelect={handleTabSelection} />
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
