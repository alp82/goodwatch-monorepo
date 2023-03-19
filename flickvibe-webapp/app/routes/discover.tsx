import { json, LoaderArgs, LoaderFunction, MetaFunction } from '@remix-run/node'
import { useFetcher, useLoaderData, useNavigate } from '@remix-run/react'
import React, { ChangeEventHandler, useEffect } from 'react'
import { titleToDashed } from '~/utils/helpers'
import {
  DiscoverMovieParams,
  DiscoverMovieResult,
  DiscoverMovieSortBy,
  DiscoverTVResult,
} from '~/server/discover.server'
import FilterKeywords from '~/ui/filter/FilterKeywords'
import NumberInput from '~/ui/input/NumberInput'
import { Keyword } from '~/server/keywords.server'
import { Genre } from '~/server/genres.server'
import FilterGenres from '~/ui/filter/FilterGenres'
import { MediaType } from '~/server/search.server'
import Tabs, { Tab } from '~/ui/Tabs'
import { ClockIcon, FilmIcon, FireIcon, StarIcon, TvIcon } from '@heroicons/react/20/solid'
import { WatchProvider } from '~/server/watchProviders.server'

export const meta: MetaFunction = () => {
  return {
    title: 'flickvibe',
    description: 'All movie and tv show ratings and streaming providers on the same page',
  }
}

export type DiscoverUrlParams = DiscoverMovieParams & { type: MediaType }

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
  const with_watch_providers = url.searchParams.get('with_watch_providers') || '8,9,337'
  const watch_region = url.searchParams.get('watch_region') || 'DE'
  const sort_by = (url.searchParams.get('sort_by') || 'popularity.desc') as DiscoverMovieSortBy

  return json<DiscoverUrlParams>({
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
    with_watch_providers,
    watch_region,
    sort_by,
  })
}

export default function Discover() {
  const params = useLoaderData()
  const navigate = useNavigate()

  const watchProvidersFetcher = useFetcher()
  useEffect(() => {
    watchProvidersFetcher.submit(
      params,
      {
        method: 'get',
        action: `/api/watch-providers/${params.type}`,
      }
    )
  }, [params.type])
  const watchProviders = watchProvidersFetcher.data?.watchProviders || []
  const availableWatchProviders = watchProviders.filter((watchProvider: WatchProvider) => '8,9,337,2,3'.split(',').includes(watchProvider.provider_id.toString()))

  const fetcher = useFetcher()
  useEffect(() => {
    if (!watchProviders) return
    // const watchProviderIds = watchProviders.map((watchProvider: WatchProvider) => watchProvider.provider_id)

    fetcher.submit(
      {
        ...params,
        // with_watch_providers: watchProviderIds.join(',')
      },
      {
        method: 'get',
        action: `/api/discover/${params.type}`,
      }
    )
  }, [params, Boolean(watchProviders)])
  const movieResults = fetcher.data?.discoverMovieResults || []
  const tvResults = fetcher.data?.discoverTVResults || []

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
  // }, {
  //   key: 'vote_average.desc',
  //   label: 'Highest rating',
  //   icon: StarIcon,
  //   current: params.sort_by === 'vote_average.desc',
  }, {
    key: params.type === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc',
    label: 'Most recent',
    icon: ClockIcon,
    current: params.sort_by === (params.type === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc'),
  }]

  const updateParams = (newParams: Record<string, string>) => {
    const nonEmptyNewParams = Object.keys(newParams).reduce((result, key) => {
      const value = newParams[key]
      if (!value) return result
      return {
        ...result,
        [key]: value,
      }
    }, {})
    navigate(`/discover?${new URLSearchParams(nonEmptyNewParams).toString()}`)
  }

  const handleSortBySelect = (tab: Tab) => {
    const newParams = {
      ...params,
      sort_by: tab.key,
    }
    updateParams(newParams)
  }

  const handleProviderToggle = (provider: WatchProvider) => {
    const currentIds = params.with_watch_providers.split(',')
    const with_watch_providers = Array.from(new Set(currentIds.includes(provider.provider_id.toString())
      ? currentIds.filter((id: string) => id !== provider.provider_id.toString())
      : [...currentIds, provider.provider_id])).join(',')
    console.log({currentIds, with_watch_providers})
    const newParams = {
      ...params,
      with_watch_providers,
    }
    updateParams(newParams)
  }

  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    const target = event.target
    const newParams = {
      ...params,
      [target.name]: target.value,
    }
    updateParams(newParams)
  }

  const handleGenresChange = (genresToInclude: Genre[], genresToExclude: Genre[]) => {
    const newParams = {
      ...params,
      with_genres: genresToInclude.map((genre) => genre.id),
      without_genres: genresToExclude.map((genre) => genre.id),
    }
    updateParams(newParams)
  }

  const handleKeywordsChange = (keywordsToInclude: Keyword[], keywordsToExclude: Keyword[]) => {
    const newParams = {
      ...params,
      with_keywords: keywordsToInclude.map((keyword) => keyword.id),
      without_keywords: keywordsToExclude.map((keyword) => keyword.id),
    }
    updateParams(newParams)
  }

  return (
    <div>
      <div className="mb-2 text-lg font-bold">Discover</div>
      <div>
        <Tabs tabs={discoverTypeTabs} pills={false} onSelect={handleTabSelect} />
      </div>
      <div className="my-4 flex flex-col gap-1">
        <span className="text-sm font-bold">Streaming:</span>
        <div className="flex flex-wrap gap-4">
        {availableWatchProviders.map((provider: WatchProvider) => {
          const isSelected = params.with_watch_providers.split(',').includes(provider.provider_id.toString())
          return (
            <div key={provider.provider_id}>
              <img
                className={`w-10 h-10 rounded-lg border-2 ${isSelected ? 'border-gray-300 hover:border-gray-500 hover:opacity-75' : 'border-gray-500 opacity-25 hover:opacity-50'}`}
                src={`https://www.themoviedb.org//t/p/original/${provider.logo_path}`}
                alt={provider.provider_name}
                title={provider.provider_name}
                onClick={() => handleProviderToggle(provider)}
              />
            </div>
          )
        })}
        </div>
      </div>
      <div className="my-4 flex flex-col flex-wrap gap-4">
        <div>
          <span className="text-sm font-bold">Release Year:</span>
          <div className="mt-1 flex gap-3 items-center">
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
        }) : (
          <div className="my-6 text-lg italic">
            No results. Try to change your search filters.
          </div>
        )}
      </div>
    </div>
  );
}
