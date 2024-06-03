import React from 'react'
import { StreamingLink, StreamingProviders } from '~/server/details.server'

export interface StreamingOverlayProps {
  links?: StreamingLink[]
}

export default function StreamingOverlay({ links }: StreamingOverlayProps) {
  // const hasProviders = providers?.flatrate && providers.flatrate.length > 0
  const hasProviders = links && links.length

  return (
    <div className="absolute bottom-1 left-1 w-full overflow-hidden flex items-center gap-1 opacity-80">
      {hasProviders ? links.map((link, index) => (
        <img
          key={`${link.provider_id}`}
          className="w-8 h-8 rounded-lg border-2 border-gray-500"
          src={`https://www.themoviedb.org/t/p/original/${link.provider_logo_path}`}
          alt={link.provider_name}
        />
      )) : <></>}
    </div>

  )
}
