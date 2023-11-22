import React from 'react'
import { StreamingLink } from '~/server/details.server'
import InfoBox from '~/ui/InfoBox'
import tmdb_logo from '~/img/tmdb-logo.svg'

export interface StreamingProps {
  links: StreamingLink[]
}

export default function Streaming({ links }: StreamingProps) {
  if (!links?.length) {
    return (
      <div className="mt-8 text-xl">no streaming providers available</div>
    )
  }

  const flatrateLinks = links.filter((link: StreamingLink) => link.stream_type == "flatrate")
  const buyLinks = links.filter((link: StreamingLink) => link.stream_type == "buy")
  const rentLinks = links.filter((link: StreamingLink) => link.stream_type == "rent")

  const hasFlatrate = Boolean(flatrateLinks.length)
  const hasBuy = Boolean(buyLinks.length)
  const hasRent = Boolean(rentLinks.length)
  const hasNothing = !hasFlatrate && !hasBuy && !hasRent

  return (
    <>
      {hasNothing && (
        <div className="mt-6">
          <InfoBox text="No streaming provider available yet" />
        </div>
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
            {flatrateLinks.map(link => {
              return (
                <a key={link.display_priority} href={link.stream_url} target="_blank" className="rounded-xl border-4 border-gray-600 hover:border-gray-500">
                  <img
                    className="w-28 h-28 rounded-lg"
                    src={`https://www.themoviedb.org/t/p/original/${link.provider_logo_path}`}
                    alt={link.provider_name}
                    title={link.provider_name}
                  />
                </a>
              )
            })}
          </div>
        </div>
      )}
      {hasBuy && (
        <div className="mt-10">
          <div className="mb-2 text-lg font-bold">Buy</div>
          <div className="flex flex-wrap gap-4">
            {buyLinks.map(link => {
              return (
                <a key={link.display_priority} href={link.stream_url} target="_blank" className="rounded-xl border-4 border-gray-600 hover:border-gray-500">
                  <img
                    className="w-10 h-10 rounded-lg"
                    src={`https://www.themoviedb.org/t/p/original/${link.provider_logo_path}`}
                    alt={link.provider_name}
                    title={link.provider_name}
                  />
                </a>
              )
            })}
          </div>
        </div>
      )}
      {hasRent && (
        <div className="mt-6">
          <div className="mb-2 text-lg font-bold">Rent</div>
          <div className="flex flex-wrap gap-4">
            {rentLinks.map(link => {
              return (
                <a key={link.display_priority} href={link.stream_url} target="_blank" className="rounded-xl border-4 border-gray-600 hover:border-gray-500">
                  <img
                    className="w-10 h-10 rounded-lg"
                    src={`https://www.themoviedb.org/t/p/original/${link.provider_logo_path}`}
                    alt={link.provider_name}
                    title={link.provider_name}
                  />
                </a>
              )
            })}
          </div>
        </div>
      )}
      <div className="mt-12 w-auto h-3 flex gap-2 items-center">
        <small>Streaming data by</small>
        <a href={flatrateLinks[0].tmdb_url} target="_blank" className="">
          <img alt="TMDB" className="h-3 w-auto" src={tmdb_logo} />
        </a>
        <small>and</small>
        <a href="https://justwatch.com" target="_blank" className="scale-125 ml-2" data-original="https://www.justwatch.com">
          <img alt="JustWatch" className="h-3 w-16" src="https://widget.justwatch.com/assets/JW_logo_color_10px.svg" />
        </a>
      </div>
    </>
  )
}
