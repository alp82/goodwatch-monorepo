import React from 'react'
import { StreamingProviders } from '~/server/details.server'

export interface StreamingOverlayProps {
  providers?: StreamingProviders
}

export default function StreamingOverlay({ providers }: StreamingOverlayProps) {
  const hasProviders = providers?.flatrate && providers.flatrate.length > 0

  return (
    <div className="absolute bottom-1 left-1 w-full overflow-hidden flex items-center gap-1 opacity-80">
      {hasProviders && providers?.flatrate.map((provider) => (
        <img
          key={provider.provider_id}
          className="w-8 h-8 rounded-lg border-2 border-gray-500"
          src={`https://www.themoviedb.org/t/p/original/${provider.logo_path}`}
          alt={provider.provider_name}
        />
      ))}
    </div>

  )
}
