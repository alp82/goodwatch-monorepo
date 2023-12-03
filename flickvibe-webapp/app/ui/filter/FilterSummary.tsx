import { DiscoverMovieParams, DiscoverTVParams } from '~/server/discover.server'
import { useFetcher } from '@remix-run/react'
import { StreamingProviderResults } from '~/server/streaming-providers.server'
import React, { useEffect } from 'react'

interface FilterSummaryParams {
  params: DiscoverMovieParams | DiscoverTVParams
  onToggle: () => void
}

export default function FilterSummary({ params, onToggle }: FilterSummaryParams) {
  const providersFetcher = useFetcher<{ streamingProviders: StreamingProviderResults }>()
  const { type } = params
  useEffect(() => {
    providersFetcher.submit(
      { type },
      {
        method: 'get',
        action: '/api/discover/streaming-providers',
      }
    )
  }, [type])
  const streamingProviders = providersFetcher.data?.streamingProviders || []

  const enabledStreamingProviders = streamingProviders
    .filter((provider) => params.withStreamingProviders.split(',').includes(provider.id.toString()))
    .map((provider) => {
      return {
        key: provider.id,
        label: provider.name,
        icon: provider.logo_path ? `https://image.tmdb.org/t/p/w45${provider.logo_path}` : undefined,
      }
    })

  const countryIcon = `https://purecatamphetamine.github.io/country-flag-icons/3x2/${params.country}.svg`

  return (
    <div className="w-full py-2 px-4 flex flex-wrap items-center gap-4 lg:gap-6 bg-gray-800 border-gray-900 rounded-2xl cursor-pointer hover:brightness-150" onClick={onToggle}>
      <button className="bg-indigo-900 py-1 px-2 rounded font-bold">Show Discover Tools</button>
      <div className="flex flex-wrap items-center gap-4 lg:gap-6">
        <div className="flex items-center gap-2 lg:gap-4">
          {enabledStreamingProviders.length > 0 && enabledStreamingProviders.map((provider) => (
            <span key={provider.key} className="flex items-center gap-2 bg-gray-700 px-2 py-1 rounded">
              <img src={provider.icon} alt={provider.label} className="h-5 w-5 flex-shrink-0 rounded-full" />
              <span className="sr-only lg:not-sr-only block text-sm truncate">{provider.label}</span>
            </span>
          ))}
        </div>
        <span className="mt-1 text-sm">in</span>
        <span className="flex items-center gap-2 bg-gray-700 px-2 py-1 rounded">
          <img src={countryIcon} alt={params.country} className="h-5 w-5 flex-shrink-0 rounded-full" />
          <span className="sr-only lg:not-sr-only block text-sm truncate">{params.country}</span>
        </span>
      </div>
      {params.minYear && params.maxYear && (
        <span className="flex items-center gap-2 bg-gray-700 px-2 py-1 rounded">
          {params.minYear === params.maxYear ? <>
            {params.maxYear}
          </> : <>
            {params.minYear} - {params.maxYear}
          </>}
        </span>
      )}
    </div>
  )
}