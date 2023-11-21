import React, { useState } from 'react'
import { StreamingProviders } from '~/server/details.server'
import InfoBox from '~/ui/InfoBox'

export interface StreamingBadgesProps {
  providers: StreamingProviders
}

export default function StreamingBadges({ providers }: StreamingBadgesProps) {
  const hasFlatrate = providers?.flatrate?.length
  const hasBuy = providers?.buy?.length
  if (!hasFlatrate) {
    return hasBuy ? (
      <div className="mt-8 text-xl">not available for streaming, but can be bought</div>
    ) : (
      <div className="mt-8 text-xl">not available for streaming</div>
    )
  }

  return (
    <>
      <div>
        <div className="flex flex-wrap gap-6">
          {providers.flatrate.map(provider => {
            return (
              <div key={provider.provider_id} className="flex items-center gap-2 pr-2 text-sm font-semibold rounded-lg bg-gray-700">
                <img
                  className="w-8 h-8 rounded-lg"
                  src={`https://www.themoviedb.org//t/p/original/${provider.logo_path}`}
                  alt={provider.provider_name}
                  title={provider.provider_name}
                />
                {provider.provider_name}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
