import React, { useState } from 'react'
import { WatchProviders } from '~/server/details.server'
import InfoBox from '~/ui/InfoBox'

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
  const hasNothing = !hasFlatrate && !hasBuy

  return (
    <>
      {hasNothing ? (
        <div className="mt-6">
          <InfoBox text="No streaming provider available yet" />
        </div>
      ) : (
        <>
          <div className="mt-6 text-xl font-bold flex items-center">
            Streaming
          </div>
          <div className="mb-2 text-sm italic">
            powered by <a href="https://justwatch.com" className="text-yellow-500 hover:text-yellow-300">Justwatch</a>
          </div>
        </>
      )}
      {hasFlatrate && (
        <div>
          <div className="mt-6 mb-2 text-lg font-bold flex items-center">
            Watch now
            <span className="ml-3 inline-flex items-center rounded bg-lime-700 px-2 h-4 text-xs font-medium text-yellow-100">
              Flatrate
            </span>
          </div>
          <div className="flex flex-wrap gap-4">
            {locationProviders.flatrate.map(provider => {
              return (
                <div key={provider.provider_id}>
                  <img
                    className="w-28 h-28 rounded-lg"
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
          <div className="mt-10 mb-2 text-lg font-bold">Buy</div>
          <div className="flex flex-wrap gap-4">
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
      {/*{hasRent && (*/}
      {/*  <div>*/}
      {/*    <div className="mt-2 mb-2 text-lg font-bold">Rent</div>*/}
      {/*    <div className="flex flex-wrap gap-4">*/}
      {/*      {locationProviders.buy.map(provider => {*/}
      {/*        return (*/}
      {/*          <div key={provider.provider_id}>*/}
      {/*            <img className="w-10 h-10 rounded-lg" src={`https://www.themoviedb.org//t/p/original/${provider.logo_path}`} alt={provider.provider_name} />*/}
      {/*          </div>*/}
      {/*        )*/}
      {/*      })}*/}
      {/*    </div>*/}
      {/*  </div>*/}
      {/*)}*/}

    </>
  )
}
