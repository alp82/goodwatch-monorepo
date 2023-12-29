import React, { useState } from 'react'
import { useLoaderData, useNavigate } from '@remix-run/react'
import { json, LoaderArgs, LoaderFunction, MetaFunction } from '@remix-run/node'
import { getDetailsForMovie, MovieDetails, ReleaseDate } from '~/server/details.server'
import Ratings from '~/ui/Ratings'
import Streaming from '~/ui/Streaming'
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
import RatingOverlay from '~/ui/RatingOverlay'
import RatingBadges from '~/ui/RatingBadges'
import StreamingBadges from '~/ui/StreamingBadges'
import Cast from '~/ui/Cast'
import Crew from '~/ui/Crew'
import ShareButton from '~/ui/ShareButton'
import { Poster } from '~/ui/Poster'
import { getLocaleFromRequest } from '~/utils/locale'

export function headers() {
  return {
    "Cache-Control": "s-max-age=60, stale-while-revalidate=3600, stale-if-error=86400",
  };
}

export const meta: MetaFunction = ({ data }) => {
  return {
    title: `${data.details.title} | Movie | GoodWatch`,
    description: 'All movie and tv show ratings and streaming providers on the same page',
  }
}

type LoaderData = {
  details: Awaited<MovieDetails>
  tab: string
}

export const loader: LoaderFunction = async ({ params, request }: LoaderArgs) => {
  const { locale } = getLocaleFromRequest(request)

  const url = new URL(request.url)
  const tab = url.searchParams.get('tab') || 'about'

  const movieId = (params.movieKey || '').split('-')[0]
  const country = url.searchParams.get('country') || locale.country
  const language = url.searchParams.get('language') || 'en'
  const details = await getDetailsForMovie({
    movieId,
    country,
    language,
  })

  return json<LoaderData>({
    details,
    tab,
  })
}

export default function MovieDetails() {
  const navigate = useNavigate()
  const { tab, details } = useLoaderData()
  const ratings = extractRatings(details)

  const { backdrop_path, cast, certifications, crew, collection, keywords, genres = [], original_title, poster_path, release_year, runtime, streaming_links, synopsis, tagline, title, videos } = details
  const ageRating = (certifications || []).length > 0 ? certifications.find((release: ReleaseDate) => release.certification) : null

  const [selectedTab, setSelectedTab] = useState(tab)
  const existingTabs = ['about', 'cast', 'ratings', 'streaming', 'videos']
  const movieTabs = existingTabs.map((tab) => {
    return {
      key: tab,
      label: tab.charAt(0).toUpperCase() + tab.slice(1),
      current: tab === selectedTab,
    }
  })
  const handleTabSelection = (tab: Tab) => {
    setSelectedTab(tab.key)
    navigate(`/movie/${details.tmdb_id}-${titleToDashed(title)}?tab=${tab.key}`)
  }

  const mainInfo = (
    <>
      {(selectedTab === 'about' || !existingTabs.includes(selectedTab)) && (
        <>
          {tagline && <div className="mb-4">
            <blockquote className="relative border-l-4 border-gray-700 pl-4 sm:pl-6">
              <p className="text-white italic sm:text-xl">
                {tagline}
              </p>
            </blockquote>
          </div>}
          <Description description={synopsis} />
          <Crew crew={crew} />
          <Collection collection={collection} movieId={details.id} />
          <Keywords keywords={keywords} type="movie" />
        </>
      )}
      {selectedTab === 'cast' && (
        <>
          <Cast cast={cast} />
        </>
      )}
      {selectedTab === 'ratings' && (
        <>
          <Ratings ratings={ratings} />
        </>
      )}
      {selectedTab === 'streaming' && (
        <>
          <Streaming links={streaming_links} />
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
      <>
        <div
          className="relative mb-2 flex min-h-64 lg:min-h-96 bg-cover bg-center bg-no-repeat before:absolute before:top-0 before:bottom-0 before:right-0 before:left-0 before:bg-black/[.68]"
          style={{backgroundImage: `url('https://www.themoviedb.org/t/p/w1920_and_h800_multi_faces/${backdrop_path}')`}}>
          <div className="md:hidden">
            <RatingOverlay ratings={ratings}/>
          </div>
          <div className="p-3 flex">
            <div className="hidden md:block relative flex-none w-40 lg:w-60">
              <RatingOverlay ratings={ratings}/>
              <Poster path={poster_path} title={title}/>
            </div>
            <div className="relative flex-1 mt-4 md:pl-4 lg:pl-8">
              <h2 className="mb-2 mr-12 text-2xl">
                <span className="text-3xl font-bold pr-2">{title}</span> ({release_year})
              </h2>
              <Genres genres={genres} type="movie"/>
              <div className="flex gap-4 items-center mb-4">
                <AgeRating ageRating={ageRating}/>
                <Runtime minutes={runtime}/>
              </div>
              <div className="mb-4">
                <RatingBadges ratings={ratings}/>
              </div>
              <div className="mb-4">
                <StreamingBadges links={streaming_links}/>
              </div>
            </div>
          </div>
          <ShareButton/>
        </div>
        <div className="my-4">
          <Tabs tabs={movieTabs} pills={true} onSelect={handleTabSelection}/>
        </div>
        <div className="hidden lg:block">
          {mainInfo}
        </div>
        <div className="block lg:hidden">
          {mainInfo}
        </div>
      </>
    </div>
  )
}
