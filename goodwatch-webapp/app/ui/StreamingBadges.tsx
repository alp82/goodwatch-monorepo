import React from 'react'
import { StreamingLink } from '~/server/details.server'
import { titleToDashed } from '~/utils/helpers'

export interface StreamingBadgesProps {
  links: StreamingLink[]
  countryCodes: string[]
}

export default function StreamingBadges({ links = [], countryCodes = [] }: StreamingBadgesProps) {
  const flatrateLinks = links.filter((link: StreamingLink) => link.stream_type == "flatrate")
  const buyLinks = links.filter((link: StreamingLink) => link.stream_type == "buy")

  const hasFlatrate = Boolean(flatrateLinks.length)
  const hasBuy = Boolean(buyLinks.length)
  if (!hasFlatrate) {
    return hasBuy ? (
      <div className="text-lg">only available for streaming to <a className="text-indigo-400 hover:underline" href="?tab=streaming">buy or rent</a></div>
    ) : countryCodes.length ? (
      <div className="text-lg">only available for streaming in <a className="text-indigo-400 hover:underline" href="?tab=streaming">other countries</a></div>
    ) : (
      <div className="text-lg">not available for streaming</div>
    )
  }

  return (
    <>
      <div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-6">
          {flatrateLinks.map((link, index) => {
            return (
              <a key={link.display_priority} href={link.stream_url} target="_blank" className="flex items-center gap-2 bg-gray-700 text-sm font-semibold shadow-2xl rounded-xl border-4 border-gray-600 hover:border-gray-500">
                <img
                  className="w-8 h-8 rounded-lg"
                  src={`https://www.themoviedb.org/t/p/original/${link.provider_logo_path}`}
                  alt={link.provider_name}
                />
                <span className={`${index < 2 ? 'pr-2' : 'sm:pr-2 hidden'} sm:block`}>
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
