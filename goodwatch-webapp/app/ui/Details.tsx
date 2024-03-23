import React, { useState } from 'react'
import { useNavigate } from '@remix-run/react'
import { MovieDetails, TVDetails } from '~/server/details.server'
import Ratings from '~/ui/ratings/Ratings'
import Streaming from '~/ui/streaming/Streaming'
import Keywords from '~/ui/Keywords'
import Genres from '~/ui/Genres'
import AgeRating from '~/ui/AgeRating'
import Description from '~/ui/Description'
import Tabs, { Tab } from '~/ui/Tabs'
import Videos from '~/ui/Videos'
import { titleToDashed } from '~/utils/helpers'
import Collection from '~/ui/Collection'
import Runtime from '~/ui/Runtime'
import { extractRatings } from '~/utils/ratings'
import RatingOverlay from '~/ui/ratings/RatingOverlay'
import RatingBlock from '~/ui/ratings/RatingBlock'
import StreamingBlock from '~/ui/streaming/StreamingBlock'
import Cast from '~/ui/Cast'
import Crew from '~/ui/Crew'
import ShareButton from '~/ui/ShareButton'
import { Poster } from '~/ui/Poster'
import TrailerOverlay from '~/ui/TrailerOverlay'

export interface DetailsProps {
  details: MovieDetails | TVDetails
  tab: string
  country: string
  language: string
}

export default function Details({ details, tab, country, language }: DetailsProps) {
  const navigate = useNavigate()
  const ratings = extractRatings(details)

  const { backdrop_path, cast, crew, genres, keywords, media_type, poster_path, release_year, streaming_country_codes, streaming_links, synopsis, tagline, title, videos } = details
  let ageRating
  let collection
  let number_of_episodes
  let number_of_seasons
  let runtime
  if (media_type === 'movie') {
    ageRating = (details.certifications || []).find((release) => release.certification)
    collection = details.collection
    runtime = details.runtime
  } else {
    ageRating = (details.certifications || []).find((release) => release.rating)
    number_of_episodes = details.number_of_episodes
    number_of_seasons = details.number_of_seasons
  }

  const [selectedTab, setSelectedTab] = useState(tab)
  const existingTabs = ['about', 'cast', 'ratings', 'streaming', 'videos']
  const detailsTabs = existingTabs.map((tab) => {
    return {
      key: tab,
      label: tab.charAt(0).toUpperCase() + tab.slice(1),
      current: tab === selectedTab,
    }
  })
  const handleTabSelection = (tab: Tab) => {
    setSelectedTab(tab.key)
    navigate(
      `/${media_type}/${details.tmdb_id}-${titleToDashed(title)}?tab=${tab.key}`,
      {
        preventScrollReset: true,
      }
      )
  }

  // const ratingsSeasonsFetcher = useFetcher()
  // useEffect(() => {
  //   ratingsSeasonsFetcher.submit(
  //     { tvId },
  //     {
  //       method: 'get',
  //       action: '/api/ratings/tv-seasons',
  //     }
  //   )
  // }, [])
  // const ratingsSeasons: RatingsProps[] = ratingsSeasonsFetcher.data?.ratings
  // const [showSeasonRatings, setShowSeasonRatings] = useState(false)
  // const handleToggleShowSeasonRatings = () => {
  //   setShowSeasonRatings(value => !value)
  // }

  const mainInfo = (
    <>
      {(selectedTab === 'about' || !existingTabs.includes(selectedTab)) && (
        <>
          <div className="md:hidden mt-8 mr-8 sm:float-left relative flex-none w-32">
            <TrailerOverlay videos={videos || []}/>
            <RatingOverlay ratings={ratings}/>
            <Poster path={poster_path} title={title}/>
          </div>
          {tagline && <div className="mb-4">
            <blockquote className="relative border-l-4 border-gray-700 pl-4 sm:pl-6">
              <p className="text-white italic sm:text-xl">
                {tagline}
              </p>
            </blockquote>
          </div>}
          <Description description={synopsis}/>
          <Crew crew={crew}/>
          {collection && <Collection collection={collection} movieId={details.tmdb_id}/>}
          <Keywords keywords={keywords} type={media_type}/>
        </>
      )}
      {selectedTab === 'cast' && (
        <>
          <Cast cast={cast}/>
        </>
      )}
      {selectedTab === 'ratings' && (
        <>
          <Ratings ratings={ratings}/>
          {/*{ratingsSeasons && ratingsSeasons.length > 1 && <div className="mt-2 ml-4">*/}
          {/*  <a onClick={handleToggleShowSeasonRatings} className="text-lg underline bold cursor-pointer hover:text-indigo-100 hover:bg-indigo-900">*/}
          {/*    {showSeasonRatings ? 'Hide' : 'Show'} Ratings per Season*/}
          {/*  </a>*/}
          {/*  {showSeasonRatings && ratingsSeasons.map((ratingsSeason, index) => (*/}
          {/*    <Ratings key={index} {...ratingsSeason} title={`Season ${index+1}`} compact={true} />*/}
          {/*  ))}*/}
          {/*</div>}*/}
        </>
      )}
      {selectedTab === 'streaming' && (
        <>
          <Streaming links={streaming_links} countryCodes={streaming_country_codes} />
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
    <>
      <div
        className="relative flex flex-col items-center mt-0 py-2 md:py-4 lg:py-8 min-h-64 lg:min-h-96 bg-cover bg-center bg-no-repeat before:absolute before:top-0 before:bottom-0 before:right-0 before:left-0 before:bg-black/[.68]"
        style={{backgroundImage: `url('https://www.themoviedb.org/t/p/w1920_and_h800_multi_faces/${backdrop_path}')`}}
      >
        <div className="relative w-full max-w-7xl">
          <div className="p-3 flex items-center">
            <div className="hidden md:block relative flex-none w-40 md:w-60">
              <TrailerOverlay videos={videos || []} />
              <RatingOverlay ratings={ratings}/>
              <Poster path={poster_path} title={title}/>
            </div>
            <div className="relative flex-1 mt-2 md:mt-4 md:pl-4 lg:pl-8">
              <h2 className="mb-2 mr-12 text-2xl">
                <span className="text-3xl font-bold pr-2">{title}</span> ({release_year})
              </h2>
              <div className="flex gap-4 items-center mb-4 ml-">
                <AgeRating ageRating={ageRating}/>
                {runtime ? <Runtime minutes={runtime}/> : null}
                {number_of_episodes && number_of_seasons ? <div className="flex gap-1">
                  <strong>{number_of_episodes}</strong>
                  Episode{number_of_episodes === 1 ? '' : 's'} in
                  <strong>{number_of_seasons}</strong>
                  Season{number_of_seasons === 1 ? '' : 's'}
                </div> : null}
              </div>
              <Genres genres={genres} type={media_type}/>
              <div className="hidden md:block mb-4">
                <RatingBlock ratings={ratings}/>
              </div>
              <div className="hidden md:block mb-4">
                <StreamingBlock media_type={media_type} links={streaming_links} countryCodes={streaming_country_codes} currentCountryCode={country} />
              </div>
            </div>
          </div>
          <ShareButton/>
        </div>
        <div className="md:hidden flex gap-4 mt-4 px-2 w-full">
          <div className="relative flex-1 mt-2">
            <div className="mb-4">
              <RatingBlock ratings={ratings}/>
            </div>
            <div className="mb-4">
              <StreamingBlock media_type={media_type} links={streaming_links} countryCodes={streaming_country_codes} currentCountryCode={country} />
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center mt-2 md:mt-4">
        <div className="px-4 sm:px-6 lg:px-8 w-full max-w-7xl">
          <div className="my-4">
            <Tabs tabs={detailsTabs} pills={true} onSelect={handleTabSelection}/>
          </div>
          <div className="hidden lg:block">
            {mainInfo}
          </div>
          <div className="block lg:hidden">
            {mainInfo}
          </div>
        </div>
      </div>
    </>
  )
}
