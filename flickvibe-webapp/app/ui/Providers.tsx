import React, { useState } from 'react'
import { WatchProviders } from '~/server/details.server'

export interface ProvidersProps {
  providers: WatchProviders
}

export default function Providers({ providers }: ProvidersProps) {
  const results = providers.results
  if (!results) {
    return (
      <div className="mt-8 text-xl">no streaming providers available</div>
    )
  }
  const locationProviders = results['DE'] || {}

  const hasFlatrate = locationProviders.flatrate?.length
  const hasBuy = locationProviders.buy?.length
  const hasRent = locationProviders.rent?.length

  return (
    <>
      {hasFlatrate && (
        <div>
          <div className="mt-6 mb-2 text-lg font-bold">Stream</div>
          <div className="flex gap-4">
            {locationProviders.flatrate.map(provider => {
              return (
                <div key={provider.provider_id}>
                  <img
                    className="w-16 h-16 rounded-lg"
                    src={`https://www.themoviedb.org//t/p/original/${provider.logo_path}`}
                    alt={provider.provider_name}
                    title={provider.provider_name}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
      {hasBuy && (
        <div>
          <div className="mt-2 mb-2 text-lg font-bold">Buy</div>
          <div className="flex gap-4">
            {locationProviders.buy.map(provider => {
              return (
                <div key={provider.provider_id}>
                  <img
                    className="w-10 h-10 rounded-lg"
                    src={`https://www.themoviedb.org//t/p/original/${provider.logo_path}`}
                    alt={provider.provider_name}
                    title={provider.provider_name}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
      {hasRent && (
        <div>
          <div className="mt-2 mb-2 text-lg font-bold">Rent</div>
          <div className="flex gap-4">
            {locationProviders.buy.map(provider => {
              return (
                <div key={provider.provider_id}>
                  <img className="w-10 h-10 rounded-lg" src={`https://www.themoviedb.org//t/p/original/${provider.logo_path}`} alt={provider.provider_name} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
