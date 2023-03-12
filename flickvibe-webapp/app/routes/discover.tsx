import { json, LoaderArgs, LoaderFunction, MetaFunction } from '@remix-run/node'
import { useFetcher, useLoaderData, useNavigate } from '@remix-run/react'
import React, { ChangeEventHandler, useEffect, useState } from 'react'
import { titleToDashed } from '~/utils/helpers'
import {
  DiscoverMovieParams,
  DiscoverMovieResult,
  DiscoverMovieSortBy,
  DiscoverTVResult,
} from '~/server/discover.server'
import Dropdown from '~/ui/Dropdown'
import FilterKeywords from '~/ui/filter/FilterKeywords'
import NumberInput from '~/ui/input/NumberInput'
import { Keyword } from '~/server/keywords.server'
import { Genre } from '~/server/genres.server'
import FilterGenres from '~/ui/filter/FilterGenres'
import { MediaType } from '~/server/search.server'
import Tabs, { Tab } from '~/ui/Tabs'
import { handle } from 'mdast-util-to-markdown/lib/handle'
import { ClockIcon, FilmIcon, FireIcon, TvIcon } from '@heroicons/react/20/solid'

export const meta: MetaFunction = () => {
  return {
    title: 'flickvibe',
    description: 'All movie and tv show ratings and streaming providers on the same page',
  }
}

export const loader: LoaderFunction = async ({ request }: LoaderArgs) => {
  const url = new URL(request.url)
  const type = (url.searchParams.get('type') || 'movie') as MediaType
  const language = url.searchParams.get('language') || 'en_US'
  const age_rating_country = url.searchParams.get('age_rating_country') || ''
  const min_age_rating = url.searchParams.get('min_age_rating') || ''
  const max_age_rating = url.searchParams.get('max_age_rating') || ''
  const min_year = url.searchParams.get('min_year') || ''
  const max_year = url.searchParams.get('max_year') || new Date().getFullYear().toString()
  const with_keywords = url.searchParams.get('with_keywords') || ''
  const without_keywords = url.searchParams.get('without_keywords') || ''
  const with_genres = url.searchParams.get('with_genres') || ''
  const without_genres = url.searchParams.get('without_genres') || ''
  const sort_by = (url.searchParams.get('sort_by') || 'popularity.desc') as DiscoverMovieSortBy

  return json<DiscoverMovieParams & { type: MediaType }>({
    type,
    language,
    age_rating_country,
    min_age_rating,
    max_age_rating,
    min_year,
    max_year,
    with_keywords,
    without_keywords,
    with_genres,
    without_genres,
    sort_by,
  })
}

export default function Discover() {
  const params = useLoaderData()
  const fetcher = useFetcher()
  const navigate = useNavigate()

  useEffect(() => {
    fetcher.submit(
      params,
      {
        method: 'get',
        action: `/api/discover/${params.type}`,
      }
    )
  }, [params])
  const movieResults = fetcher.data?.discoverMovieResults?.results || []
  const tvResults = fetcher.data?.discoverTVResults?.results || []

  const discoverTypeTabs: Tab[] = [{
    key: 'movie',
    label: 'Movies',
    icon: FilmIcon,
    current: params.type === 'movie',
  }, {
    key: 'tv',
    label: 'TV Shows',
    icon: TvIcon,
    current: params.type === 'tv',
  }]

  const handleTabSelect = (tab: Tab) => {
    const newParams = {
      ...params,
      type: tab.key,
    }
    navigate(`/discover?${new URLSearchParams(newParams).toString()}`)
  }

  const sortByTabs: Tab[] = [{
    key: 'popularity.desc',
    label: 'Most popular',
    icon: FireIcon,
    current: params.sort_by === 'popularity.desc',
  }, {
    key: params.type === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc',
    label: 'Most recent',
    icon: ClockIcon,
    current: params.sort_by === (params.type === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc'),
  }]

  const handleSortBySelect = (tab: Tab) => {
    const newParams = {
      ...params,
      sort_by: tab.key,
    }
    navigate(`/discover?${new URLSearchParams(newParams).toString()}`)
  }

  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    const target = event.target
    const newParams = {
      ...params,
      [target.name]: target.value,
    }
    navigate(`/discover?${new URLSearchParams(newParams).toString()}`)
  }

  const handleGenresChange = (genresToInclude: Genre[], genresToExclude: Genre[]) => {
    const newParams = {
      ...params,
      with_genres: genresToInclude.map((genre) => genre.id),
      without_genres: genresToExclude.map((genre) => genre.id),
    }
    navigate(`/discover?${new URLSearchParams(newParams).toString()}`)
  }

  const handleKeywordsChange = (keywordsToInclude: Keyword[], keywordsToExclude: Keyword[]) => {
    const newParams = {
      ...params,
      with_keywords: keywordsToInclude.map((keyword) => keyword.id),
      without_keywords: keywordsToExclude.map((keyword) => keyword.id),
    }
    navigate(`/discover?${new URLSearchParams(newParams).toString()}`)
  }

  return (
    <div>
      <div className="mb-2 text-lg font-bold">Discover</div>
      <div>
        <Tabs tabs={discoverTypeTabs} pills={false} onSelect={handleTabSelect} />
      </div>
      <div className="my-4 flex flex-col flex-wrap gap-4">
        <div>
          <span className="text-sm font-bold">Release Year:</span>
          <div className="flex gap-3 items-center">
            <NumberInput name="min_year" placeholder="Min Year" onChange={handleChange} />
            <span className="italic">to</span>
            <NumberInput name="max_year" placeholder="Max Year" onChange={handleChange} />
          </div>
        </div>
        <div>
          <span className="text-sm font-bold">Genres:</span>
          <FilterGenres type={params.type} withGenres={params.with_genres} withoutGenres={params.without_genres} onChange={handleGenresChange} />
        </div>
        <div>
          <span className="text-sm font-bold">Tags:</span>
          <FilterKeywords withKeywords={params.with_keywords} withoutKeywords={params.without_keywords} onChange={handleKeywordsChange} />
        </div>
        <div>
          <Tabs tabs={sortByTabs} pills={true} onSelect={handleSortBySelect} />
        </div>
      </div>
      <div className="mt-8 flex flex-wrap gap-4">
        {movieResults.length > 0 ? movieResults.map((movie: DiscoverMovieResult) => {
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
        }) : tvResults.length > 0 ? tvResults.map((tv: DiscoverTVResult) => {
          return (
            <a key={tv.id} className="flex flex-col w-36 border-4 border-transparent hover:bg-indigo-900 hover:border-indigo-900" href={`/movie/${tv.id}-${titleToDashed(tv.name)}`}>
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
        }) : (
          <div className="my-6 text-lg italic">
            No results. Try to change your search filters.
          </div>
        )}
      </div>
    </div>
  );
}
