import React, { useState } from 'react'
import { json, LoaderArgs, LoaderFunction, MetaFunction } from '@remix-run/node'
import { PrefetchPageLinks, useLoaderData, useNavigate, useNavigation } from '@remix-run/react'
import { ClockIcon, FilmIcon, FireIcon, StarIcon, TvIcon } from '@heroicons/react/20/solid'
import { AnimatePresence, motion } from 'framer-motion'
import {
  DiscoverMovieParams,
  DiscoverMovie,
  DiscoverTV,
  DiscoverTVParams,
  getDiscoverMovieResults,
} from '~/server/discover.server'
import { MediaType } from '~/server/search.server'
import Tabs, { Tab } from '~/ui/Tabs'
import { MovieCard } from '~/ui/MovieCard'
import { TvCard } from '~/ui/TvCard'
import FilterSelection from '~/ui/filter/FilterSelection'
import FilterSummary from '~/ui/filter/FilterSummary'
import useLocale, { getLocaleFromRequest } from '~/utils/locale'

export function headers() {
  return {
    "Cache-Control": "max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400",
  };
}

export const meta: MetaFunction = () => {
  return {
    title: 'Discover | GoodWatch',
    description: 'All movie and tv show ratings and streaming providers on the same page',
  }
}

export type LoaderData = {
  params: DiscoverMovieParams | DiscoverTVParams,
  results: DiscoverMovie[] | DiscoverTV[],
}

export const loader: LoaderFunction = async ({ request }: LoaderArgs) => {
  const { locale } = getLocaleFromRequest(request)

  const url = new URL(request.url)
  const type = (url.searchParams.get('type') || 'movie') as MediaType
  const mode = (url.searchParams.get('mode') || 'advanced') as 'advanced'
  const country = url.searchParams.get('country') || locale.country
  const language = url.searchParams.get('language') || locale.language
  const minAgeRating = url.searchParams.get('minAgeRating') || ''
  const maxAgeRating = url.searchParams.get('maxAgeRating') || ''
  const minYear = url.searchParams.get('minYear') || ''
  // const maxYear = url.searchParams.get('maxYear') || new Date().getFullYear().toString()
  const maxYear = url.searchParams.get('maxYear') || ''
  const minScore = url.searchParams.get('minScore') || ''
  const withKeywords = url.searchParams.get('withKeywords') || ''
  const withoutKeywords = url.searchParams.get('withoutKeywords') || ''
  const withGenres = url.searchParams.get('withGenres') || ''
  const withoutGenres = url.searchParams.get('withoutGenres') || ''
  const withStreamingProviders = url.searchParams.get('withStreamingProviders') || '8,9,337'
  const sortBy = (url.searchParams.get('sortBy') || 'popularity') as DiscoverMovieSortBy
  const sortDirection = (url.searchParams.get('sortDirection') || 'desc') as 'asc' | 'desc'
  const params = {
    type,
    mode,
    country,
    language,
    minAgeRating,
    maxAgeRating,
    minYear,
    maxYear,
    minScore,
    withKeywords,
    withoutKeywords,
    withGenres,
    withoutGenres,
    withStreamingProviders,
    sortBy,
    sortDirection,
  }

  const results = await getDiscoverMovieResults(params)

  return json<LoaderData>({
    params,
    results,
  })
}

export default function Discover() {
  const { params, results } = useLoaderData<LoaderData>()
  const navigate = useNavigate()
  const navigation = useNavigation()
  const { locale } = useLocale();

  // const watchProvidersFetcher = useFetcher()
  // useEffect(() => {
  //   watchProvidersFetcher.submit(
  //     params,
  //     {
  //       method: 'get',
  //       action: `/api/watch-providers/${params.type}`,
  //     }
  //   )
  // }, [params.type])
  // const watchProviders = watchProvidersFetcher.data?.watchProviders || []
  // const availableWatchProviders = watchProviders.filter((watchProvider: WatchProvider) => '8,9,337,2,3'.split(',').includes(watchProvider.provider_id.toString()))

  const [currentParams, setCurrentParams] = useState(params)

  const discoverTypeTabs: Tab[] = [{
    key: 'movie',
    label: 'Movies',
    icon: FilmIcon,
    current: currentParams.type === 'movie',
  }, {
    key: 'tv',
    label: 'TV Shows',
    icon: TvIcon,
    current: currentParams.type === 'tv',
  }]

  const sortByTabs: Tab[] = [{
    key: 'popularity',
    label: 'Most popular',
    icon: FireIcon,
    current: currentParams.sortBy === 'popularity',
  }, {
    key: 'aggregated_score',
    label: 'Highest rating',
    icon: StarIcon,
    current: currentParams.sortBy === 'aggregated_score',
  }, {
    key: 'release_date',
    label: 'Most recent',
    icon: ClockIcon,
    current: currentParams.sortBy === 'release_date',
  }]

  const [filtersOpen, setFiltersOpen] = useState(false)
  const toggleFilters = () => {
    setFiltersOpen((isOpen) => !isOpen)
  }

  const getNonEmptyParams = (newParams: Record<string, string>) => {
    return Object.keys(newParams).sort().reduce((result, key) => {
      const value = newParams[key]
      if (!value) return result
      return {
        ...result,
        [key]: value,
      }
    }, {}) as LoaderData["params"]
  }

  const constructUrl = (newParams: Record<string, string>) => {
    const nonEmptyNewParams = getNonEmptyParams(newParams)
    return `/discover?${new URLSearchParams(nonEmptyNewParams).toString()}`
  }

  const updateParams = (newParams: Record<string, string>) => {
    const nonEmptyNewParams = getNonEmptyParams(newParams)
    setCurrentParams(nonEmptyNewParams)
    navigate(constructUrl(newParams))
  }

  const handleTabSelect = (tab: Tab) => {
    const newParams = {
      ...currentParams,
      type: tab.key,
    }
    updateParams(newParams)
  }

  const handleSortBySelect = (tab: Tab) => {
    const newParams = {
      ...currentParams,
      sortBy: tab.key,
    }
    updateParams(newParams)
  }

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-5 sm:gap-6">
      <div>
        <Tabs tabs={discoverTypeTabs} pills={false} onSelect={handleTabSelect} />
        <PrefetchPageLinks key="discover-type" page={constructUrl({
          ...currentParams,
          type: params.type === 'movie' ? 'tv' : 'movie',
        })} />
      </div>
      <FilterSummary params={currentParams} onToggle={toggleFilters} />
      <FilterSelection show={filtersOpen} params={currentParams} updateParams={updateParams} onClose={() => setFiltersOpen(false)} />
      <div className="mt-2">
        <Tabs tabs={sortByTabs} pills={true} onSelect={handleSortBySelect} />
        {sortByTabs.filter((tab) => !tab.current).map((tab) => (
          <PrefetchPageLinks key={tab.key} page={constructUrl({
            ...currentParams,
            sortBy: tab.key,
          })} />
        ))}
      </div>
      <div className={`relative mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4`}>
        <AnimatePresence initial={false}>
          {navigation.state === 'loading' && (
            <span className="absolute top-2 left-6 animate-ping inline-flex h-8 w-8 rounded-full bg-sky-300 opacity-75" />
          )}
          {!results.length && navigation.state === 'idle' && (
            <div className="my-6 text-lg italic">
              No results. Try to change your search filters.
            </div>
          )}
          {results.length > 0 && navigation.state === 'idle' && results.map((result: DiscoverMovie | DiscoverTV, index) => {
            return (
              <div key={result.tmdb_id}>
                <motion.div
                  key={currentParams.sortBy}
                  initial={{y: `-${Math.floor(Math.random()*10) + 5}%`, opacity: 0}}
                  animate={{y: '0', opacity: 1}}
                  exit={{y: `${Math.floor(Math.random()*10) + 5}%`, opacity: 0}}
                  transition={{duration: 0.5, type: 'tween'}}
                >
                  {currentParams.type === 'movie' && <MovieCard movie={result as DiscoverMovie} prefetch={index < 6} />}
                  {currentParams.type === 'tv' && <TvCard tv={result as DiscoverTV} prefetch={index < 6} />}
                </motion.div>
              </div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
