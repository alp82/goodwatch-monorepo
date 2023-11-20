import React, { useState } from 'react'
import { StreamingProviders } from '~/server/details.server'
import InfoBox from '~/ui/InfoBox'

export interface ProvidersProps {
  providers: StreamingProviders
}

export default function Providers({ providers }: ProvidersProps) {
  if (!providers) {
    return (
      <div className="mt-8 text-xl">no streaming providers available</div>
    )
  }

  const hasFlatrate = providers.flatrate?.length
  const hasBuy = providers.buy?.length
  const hasRent = providers.rent?.length
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
            powered by <a href="https://justwatch.com" className="text-yellow-500 hover:text-yellow-300">JustWatch</a>
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
            {providers.flatrate.map(provider => {
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
            {providers.buy.map(provider => {
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
      {/*      {providers.buy.map(provider => {*/}
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
