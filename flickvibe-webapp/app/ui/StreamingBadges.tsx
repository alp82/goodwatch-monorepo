import React from 'react'
import { StreamingLink } from '~/server/details.server'
import { titleToDashed } from '~/utils/helpers'

export interface StreamingBadgesProps {
  links: StreamingLink[]
}

export default function StreamingBadges({ links = [] }: StreamingBadgesProps) {
  const flatrateLinks = links.filter((link: StreamingLink) => link.stream_type == "flatrate")
  const buyLinks = links.filter((link: StreamingLink) => link.stream_type == "buy")

  const hasFlatrate = Boolean(flatrateLinks.length)
  const hasBuy = Boolean(buyLinks.length)
  if (!hasFlatrate) {
    return hasBuy ? (
      <div className="text-xl">not available for streaming, but can be bought</div>
    ) : (
      <div className="text-xl">not available for streaming</div>
    )
  }

  return (
    <>
      <div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-6">
          {flatrateLinks.map(link => {
            return (
              <a key={link.display_priority} href={link.stream_url} target="_blank" className="flex items-center gap-2 sm:pr-2 text-sm font-semibold rounded-lg bg-gray-700">
                <img
                  className="w-8 h-8 rounded-lg"
                  src={`https://www.themoviedb.org/t/p/original/${link.provider_logo_path}`}
                  alt={link.provider_name}
                  title={link.provider_name}
                />
                <span className="hidden sm:block">
                  {link.provider_name}
                </span>
              </a>
            )
          })}
        </div>
      </div>
    </>
  )
}
