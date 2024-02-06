import React from 'react'
import { PlayCircleIcon } from '@heroicons/react/24/solid'
import { Videos } from '~/server/details.server'
import { Tab } from '~/ui/Tabs'

export interface TrailerOverlayProps {
  videos: Videos
  handleTabSelection: (tab: Tab) => void
}

export default function TrailerOverlay({ videos, handleTabSelection }: TrailerOverlayProps) {
  const hasTrailers = videos?.trailers?.length

  const handleShowTrailer = () => {
    handleTabSelection({ key: 'videos' })
  }

  return (
    <>
      {hasTrailers ? (
        <a className="absolute flex flex-col items-center justify-center w-full h-full bg-black bg-opacity-0 hover:bg-opacity-50 cursor-pointer" onClick={handleShowTrailer}>
          <PlayCircleIcon className="relative bottom-4 w-16 h-16 md:w-24 md:h-24 lg:w-32 lg:h-32 mx-auto opacity-80" />
          <p className="absolute bottom-3 py-2 w-full bg-black bg-opacity-80 font-bold text-center">Play Trailer</p>
        </a>
      ) : null}
    </>
  )
}
